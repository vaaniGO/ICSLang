let _ =
  (* For loop *)
  for i = 0 to 10 do
    Printf.printf "i = %d\n" i
  done

  (*
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
    Printf.printf "Odd\n" *)

    (* let abs_value (x: int) : int = 
    match x with
    | x when x < 0 -> -x
    | _ -> x
;;

let rec gcd (x: int) (y: int) : int = 
    match (x,y) with
    | _ when x = 0 && y = 0 -> failwith "GCD undefined."
    | _ -> 
        match (abs_value x, abs_value y) with
        | (x', y') when x' = y' -> x'
        | (0, y') -> y'
        | (x', 0) -> x'
        | (x', y') when x' > y' -> gcd (x'-y') (y')
        | (x', y') -> gcd (x') (y'-x')
;; *)
