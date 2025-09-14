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
    Printf.printf "✅ YAYCaml! %s\n" filename
  with
  | Location.Error error ->
      (* Simple error printing that should work across versions *)
      (* Printf.eprintf "🐫 OOPSCaml! Error: in %s \n" filename; *)
      Printf.eprintf "Location error: %s\n" (Printexc.to_string (Location.Error error));
      exit 1
  | Syntaxerr.Error error ->
      Printf.eprintf "🐫 OOPSCaml! Syntax error in %s \n" filename;
      Printf.eprintf "Syntax error: %s\n" (Printexc.to_string (Syntaxerr.Error error));
      exit 1
  | exn ->
      Printf.eprintf "🐫 OOPSCaml! An unexpected error occurred in %s %s\n" filename (Printexc.to_string exn);
      exit 1

let () =
  let filename = ref "" in
  let args = Array.to_list Sys.argv in
  let rec process_args = function
    | [] -> ()
    | "-allow_for_loops" :: rest ->
        Ppx_1.allow_for_loops := true;
        process_args rest
    | "-allow_while_loops" :: rest ->
        Ppx_1.allow_while_loops := true;
        process_args rest
    | "-allow_lambdas" :: rest ->
        Ppx_1.allow_lambdas := true;
        process_args rest
    | "-allow_mutability" :: rest ->
        Ppx_1.allow_mutability := true;
        process_args rest
    | arg :: rest ->
        if String.get arg 0 = '-' then
          (* Unknown flag, ignore *)
          process_args rest
        else if !filename = "" then (
          filename := arg;
          process_args rest
        ) else
          process_args rest
  in
  process_args (List.tl args);
  
  if !filename = "" then (
    Printf.eprintf "Usage: %s [flags] <file-to-check.ml>\n" Sys.argv.(0);
    Printf.eprintf "Flags: -allow_for_loops, -allow_while_loops, -allow_lambdas, -allow_mutability\n";
    exit 1
  );
  check_file !filename