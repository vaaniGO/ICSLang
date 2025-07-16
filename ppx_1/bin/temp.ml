  with
  | Location.Error error ->
      Printf.eprintf "🐫 OOPSCaml! Error: in %s \n" filename;
      exit 1
  | Syntaxerr.Error error ->
      Printf.eprintf "🐫 OOPSCaml! Syntax error in %s \n" filename;
      exit 1
  | exn ->
      Printf.eprintf "🐫 OOPSCaml! An unexpected error occurred: %s \n";
      exit 1