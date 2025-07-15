(* This should fail — no argument or return type *)
(* let f x = x + 1

(* This should fail — even if there's a return type but no argument type *)
let g x : int = x * 2

(* This should fail — argument has type but return type is missing *)
let h (x : int) = x * 2 *)

(* This should pass — fully typed *)
(* let f (x : int) : int = x + 1;; *)

let f (x : int) = x * 2;;

print_int(f 5);;
