let _ =
  (* For loop *)
  for i = 0 to 10 do
    Printf.printf "i = %d\n" i
  done

let _ =
  (* While loop *)
  let x = ref 0 in
  while !x < 5 do
    Printf.printf "x = %d\n" !x;
    incr x
  done

let _ =
  (* If-then-else *)
  let y = 3 in
  if y mod 2 = 0 then
    Printf.printf "Even\n"
  else
    Printf.printf "Odd\n"
