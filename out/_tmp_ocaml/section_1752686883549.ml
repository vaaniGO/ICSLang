let search (arr : int list) (target : int) : int =
  let i = ref 0 in
  let index = ref (-1) in
  let len = List.length arr in
  while !i < len do
    match List.nth arr !i with
    | n when n=target -> index := !i; i := len;
    | _ -> i := !i + 1;
  done;
  !index
;;