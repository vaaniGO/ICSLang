open Parsetree
open Yojson.Safe

(* Parse OCaml source into Parsetree.structure *)
let parse_file filename =
  let ch = open_in filename in
  let lexbuf = Lexing.from_channel ch in
  lexbuf.lex_curr_pos <- { lexbuf.lex_curr_pos with pms_name = filename };
  let ast = Parse.implementation lexbuf in
  close_in ch;
  ast

(* Convert a simple subset of the AST into JSON *)
let rec expr_to_json (e: expression) : Yojson.Safe.t =
  match e.pexp_desc with
  | Pexp_constant (Const_int n) ->
      `Assoc [("kind", `String "IntLiteral"); ("value", `Int n)]
  | Pexp_constant (Const_int32 n) ->
      `Assoc [("kind", `String "Int32Literal"); ("value", `Int (Int32.to_int n))]
  | Pexp_constant (Const_int64 n) ->
      `Assoc [("kind", `String "Int64Literal"); ("value", `String (Int64.to_string n))]
  | Pexp_constant (Const_nativeint n) ->
      `Assoc [("kind", `String "NativeIntLiteral"); ("value", `String (Nativeint.to_string n))]
  | Pexp_constant (Const_float f) ->
      `Assoc [("kind", `String "FloatLiteral"); ("value", `Float (float_of_string f))]
  | Pexp_constant (Const_char c) ->
      `Assoc [("kind", `String "CharLiteral"); ("value", `String (String.make 1 c))]
  | Pexp_constant (Const_string (s, _, _)) ->
      `Assoc [("kind", `String "StringLiteral"); ("value", `String s)]
  | Pexp_ident { txt = Longident.Lident name; _ } ->
      `Assoc [("kind", `String "Var"); ("name", `String name)]
  | Pexp_ident { txt = longident; _ } ->
      `Assoc [("kind", `String "QualifiedVar"); ("name", `String (String.concat "." (Longident.flatten longident)))]
  | Pexp_ifthenelse (cond, then_, Some else_) ->
      `Assoc [
        ("kind", `String "IfExpr");
        ("cond", expr_to_json cond);
        ("thenBranch", expr_to_json then_);
        ("elseBranch", expr_to_json else_)
      ]
  | Pexp_ifthenelse (cond, then_, None) ->
      `Assoc [
        ("kind", `String "IfExpr");
        ("cond", expr_to_json cond);
        ("thenBranch", expr_to_json then_);
        ("elseBranch", `Null)
      ]
  | Pexp_apply ({pexp_desc = Pexp_ident { txt = Longident.Lident fn; _ }; _}, args) ->
      `Assoc [
        ("kind", `String "Call");
        ("fn", `String fn);
        ("args", `List (List.map (fun (_, e) -> expr_to_json e) args))
      ]
  | Pexp_apply (func, args) ->
      `Assoc [
        ("kind", `String "Apply");
        ("func", expr_to_json func);
        ("args", `List (List.map (fun (_, e) -> expr_to_json e) args))
      ]
  | Pexp_let (rec_flag, bindings, body) ->
      `Assoc [
        ("kind", `String "Let");
        ("recursive", `Bool (rec_flag = Recursive));
        ("bindings", `List (List.map value_binding_to_json bindings));
        ("body", expr_to_json body)
      ]
  | Pexp_fun (arg_label, default, pattern, body) ->
      `Assoc [
        ("kind", `String "Fun");
        ("arg", pattern_to_json pattern);
        ("body", expr_to_json body)
      ]
  | Pexp_match (expr, cases) ->
      `Assoc [
        ("kind", `String "Match");
        ("expr", expr_to_json expr);
        ("cases", `List (List.map case_to_json cases))
      ]
  | Pexp_tuple exprs ->
      `Assoc [
        ("kind", `String "Tuple");
        ("elements", `List (List.map expr_to_json exprs))
      ]
  | Pexp_construct ({ txt = Longident.Lident name; _ }, None) ->
      `Assoc [("kind", `String "Constructor"); ("name", `String name); ("args", `List [])]
  | Pexp_construct ({ txt = Longident.Lident name; _ }, Some arg) ->
      `Assoc [("kind", `String "Constructor"); ("name", `String name); ("args", `List [expr_to_json arg])]
  | _ ->
      `Assoc [("kind", `String "Unknown")]

and pattern_to_json (p: pattern) : Yojson.Safe.t =
  match p.ppat_desc with
  | Ppat_var { txt = name; _ } ->
      `Assoc [("kind", `String "VarPattern"); ("name", `String name)]
  | Ppat_any ->
      `Assoc [("kind", `String "WildcardPattern")]
  | Ppat_constant (Const_int n) ->
      `Assoc [("kind", `String "IntPattern"); ("value", `Int n)]
  | Ppat_construct ({ txt = Longident.Lident name; _ }, None) ->
      `Assoc [("kind", `String "ConstructorPattern"); ("name", `String name); ("args", `List [])]
  | Ppat_construct ({ txt = Longident.Lident name; _ }, Some arg) ->
      `Assoc [("kind", `String "ConstructorPattern"); ("name", `String name); ("args", `List [pattern_to_json arg])]
  | _ ->
      `Assoc [("kind", `String "UnknownPattern")]

and case_to_json (case: case) : Yojson.Safe.t =
  `Assoc [
    ("pattern", pattern_to_json case.pc_lhs);
    ("guard", match case.pc_guard with None -> `Null | Some e -> expr_to_json e);
    ("body", expr_to_json case.pc_rhs)
  ]

and value_binding_to_json (vb: value_binding) : Yojson.Safe.t =
  `Assoc [
    ("pattern", pattern_to_json vb.pvb_pat);
    ("expr", expr_to_json vb.pvb_expr)
  ]

let structure_item_to_json (si: structure_item) : Yojson.Safe.t =
  match si.pstr_desc with
  | Pstr_value (rec_flag, vbs) ->
      `Assoc [
        ("kind", `String "Value");
        ("recursive", `Bool (rec_flag = Recursive));
        ("bindings", `List (List.map value_binding_to_json vbs))
      ]
  | Pstr_type (rec_flag, type_decls) ->
      `Assoc [("kind", `String "TypeDecl"); ("recursive", `Bool (rec_flag = Recursive))]
  | Pstr_module mb ->
      `Assoc [("kind", `String "Module")]
  | Pstr_open od ->
      `Assoc [("kind", `String "Open")]
  | _ -> 
      `Assoc [("kind", `String "UnknownStruct")]

let () =
  let file =
    if Array.length Sys.argv > 1 then Sys.argv.(1)
    else (print_endline "Usage: dune exec ./ast_to_json <file.ml>"; exit 1)
  in
  try
    let ast = parse_file file in
    let json = `List (List.map structure_item_to_json ast) in
    Yojson.Safe.pretty_to_channel stdout json;
    print_newline ()
  with
  | Sys_error msg -> 
      Printf.eprintf "Error: %s\n" msg; exit 1
  | Syntaxerr.Error _ ->
      Printf.eprintf "Syntax error in %s\n" file; exit 1
  | exn ->
      Printf.eprintf "Error: %s\n" (Printexc.to_string exn); exit 1 
(*
  Some documentation: 
  To run the executable from ocaml_ast/ : dune exec _build/default/ocaml_ast.exe
  Steps to create this project:
  Create a directory myDir
  run dune init exe executable_name
  config the dune file
  add a dune-project file in your root 
  config that 
  populate executable_name.ml 
*)