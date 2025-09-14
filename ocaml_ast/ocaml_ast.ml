open Parsetree
open Yojson.Safe

(* Parse OCaml source into Parsetree.structure *)
let parse_file filename =
  let ch = open_in filename in
  let lexbuf = Lexing.from_channel ch in
  (* Set filename for better error messages - works across OCaml versions *)
  (try
    lexbuf.lex_curr_pos <- { lexbuf.lex_curr_pos with pos_fname = filename }
   with _ ->
     (* Fallback - some versions might not have pos_fname *)
     ());
  let ast = Parse.implementation lexbuf in
  close_in ch;
  ast


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