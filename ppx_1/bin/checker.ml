open Ppxlib

let read_file filename =
  let ic = open_in filename in
  let content = really_input_string ic (in_channel_length ic) in
  close_in ic;
  content

let parse_file filename =
  let content = read_file filename in
  let lexbuf = Lexing.from_string content in
  Lexing.set_filename lexbuf filename;
  Parse.implementation lexbuf

let check_file filename =
  try
    let ast = parse_file filename in
    let enforcer = Ppx_1.ppx_enforcer_rules in
    enforcer#structure ast;
    Printf.printf "✅ OK: No violations found in %s\n" filename
  with
  | Location.Error error ->
      Printf.eprintf "Error in %s: %s\n" filename (Printexc.to_string (Location.Error error));
      exit 1
  | Syntaxerr.Error error ->
      Printf.eprintf "Syntax error in %s: %s\n" filename (Printexc.to_string (Syntaxerr.Error error));
      exit 1
  | exn ->
      Printf.eprintf "An unexpected error occurred: %s\n" (Printexc.to_string exn);
      exit 1

let () =
  if Array.length Sys.argv <> 2 then (
    Printf.eprintf "Usage: %s <file-to-check.ml>\n" Sys.argv.(0);
    exit 1
  );
  check_file Sys.argv.(1)