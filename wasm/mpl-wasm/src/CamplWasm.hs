{-# LANGUAGE ForeignFunctionInterface #-}
{-# LANGUAGE LambdaCase #-}
{-# LANGUAGE ScopedTypeVariables #-}
{-# LANGUAGE TypeApplications #-}

-- | WebAssembly reactor entry point for the CaMPL frontend.
--
-- Exposes a single JS-callable function, @camplCompile@, which runs the real
-- MPL pipeline (parse → rename → typecheck → pattern-compile → lambda-lift) on a
-- source string and returns a JSON payload of stage dumps + diagnostics — the
-- exact shape the app's @CompileResult@ expects.
--
-- The @assembled@ stage lives in MPLASM (which depends on MPLMACH's sockets) and
-- is deferred to M2 along with the abstract machine.
module Main (main, camplCompile) where

import Data.Char (ord)
import Data.List (intercalate)
import Data.Proxy (Proxy (..))
import Numeric (showHex)
import GHC.Wasm.Prim

import qualified MplPasses.Parser.BnfcParse as B
import MplPasses.Parser.Parse (runParse')
import MplPasses.Renamer.Rename (runRename')
import MplPasses.TypeChecker.TypeCheck (runTypeCheck')
import MplPasses.PatternCompiler.PatternCompile (runPatternCompile')
import MplPasses.LambdaLifter.LambdaLift (runLambdaLiftProg)
import MplPasses.Passes (MplPassesEnv (..), mplPassesEnv)
import MplPasses.PassesErrors (MplPassesErrors, pprintMplPassesErrors)
import MplAST.MplCore
import MplUtil.UniqueSupply (uniqueSupplies)

main :: IO ()
main = pure ()

foreign export javascript "camplCompile"
  camplCompile :: JSString -> IO JSString

data Stage = Stage {stId :: String, stLabel :: String, stOut :: String}

data Diag = Diag {dgStage :: String, dgMsg :: String}

camplCompile :: JSString -> IO JSString
camplCompile js = do
  let src = fromJSString js
  env <- mplPassesEnv
  let toplvl = mplPassesTopLevel env
      (s0 : s1 : s2 : _) = uniqueSupplies (mplPassesEnvUniqueSupply env)

      errsAt :: String -> [MplPassesErrors] -> [Diag]
      errsAt stage errs = [Diag stage (show (pprintMplPassesErrors errs))]

      result :: (Bool, [Stage], [Diag])
      result =
        case B.runBnfc src :: Either [MplPassesErrors] B.MplProg of
          Left errs -> (False, [], errsAt "parsed" errs)
          Right bnfc ->
            case runParse' bnfc :: Either [MplPassesErrors] (MplProg MplParsed) of
              Left errs -> (False, [], errsAt "parsed" errs)
              Right parsed ->
                let sParsed = Stage "parsed" "Parsed" (pprint (Proxy @MplParsed) parsed)
                 in case runRename' (toplvl, s0) parsed :: Either [MplPassesErrors] (MplProg MplRenamed) of
                      Left errs -> (False, [sParsed], errsAt "renamed" errs)
                      Right renamed ->
                        let sRenamed = Stage "renamed" "Renamed" (pprint (Proxy @MplRenamed) renamed)
                         in case runTypeCheck' (toplvl, s1) renamed :: Either [MplPassesErrors] (MplProg MplTypeChecked) of
                              Left errs -> (False, [sParsed, sRenamed], errsAt "type-checked" errs)
                              Right typechecked ->
                                let sTc = Stage "type-checked" "Type-checked" (pprint (Proxy @MplTypeChecked) typechecked)
                                 in case runPatternCompile' (toplvl, s2) typechecked :: Either [MplPassesErrors] (MplProg MplPatternCompiled) of
                                      Left errs -> (False, [sParsed, sRenamed, sTc], errsAt "pattern-compiled" errs)
                                      Right patc ->
                                        let sPc = Stage "pattern-compiled" "Pattern-compiled" (pprint (Proxy @MplPatternCompiled) patc)
                                            lifted = runLambdaLiftProg patc
                                            sLl = Stage "lambda-lifted" "Lambda-lifted" (pprint (Proxy @MplLambdaLifted) lifted)
                                         in (True, [sParsed, sRenamed, sTc, sPc, sLl], [])
      (ok, stages, diags) = result
  pure (toJSString (renderJson ok stages diags))

-- --- minimal JSON encoding ---------------------------------------------------

renderJson :: Bool -> [Stage] -> [Diag] -> String
renderJson ok stages diags =
  obj
    [ ("ok", if ok then "true" else "false"),
      ("stages", arr (map stageJson stages)),
      ("diagnostics", arr (map diagJson diags))
    ]
  where
    stageJson (Stage i l o) =
      obj [("stage", str i), ("label", str l), ("output", str o)]
    diagJson (Diag s m) =
      obj [("severity", str "error"), ("stage", str s), ("message", str m)]

obj :: [(String, String)] -> String
obj kvs = "{" ++ intercalate "," [str k ++ ":" ++ v | (k, v) <- kvs] ++ "}"

arr :: [String] -> String
arr xs = "[" ++ intercalate "," xs ++ "]"

str :: String -> String
str s = '"' : concatMap esc s ++ "\""
  where
    esc c = case c of
      '"' -> "\\\""
      '\\' -> "\\\\"
      '\n' -> "\\n"
      '\r' -> "\\r"
      '\t' -> "\\t"
      _
        | ord c < 0x20 ->
            let h = showHex (ord c) ""
             in "\\u" ++ replicate (4 - length h) '0' ++ h
        | otherwise -> [c]
