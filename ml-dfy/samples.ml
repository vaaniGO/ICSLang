let rec factorial n =
  if n = 0 then 1
  else n * factorial (n - 1)


let rec power x n =
  if n = 0 then 1
  else x * power x (n - 1)

let rec gcd a b =
  if b = 0 then a
  else gcd b (a mod b)

(* Why no loops? Becuase (1) Require invariant / decreases clause specifications in a 
   way that dafny wants it, not in an intuitive way always - requires understanding
   how dafny verifies programs. 

  *)

