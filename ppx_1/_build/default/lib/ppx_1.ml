open Ppxlib

module StringSet = Set.Make(String)

(* Flags for optional features/restrictions *)
let allow_for_loops = ref false
let allow_while_loops = ref false
let allow_lambdas = ref false
let allow_mutability = ref false

(* Helper to check if function arguments and return type are annotated *)
let all_fun_args_are_annotated entry_expr =
  let rec check_params expr =
    match expr.pexp_desc with
    | Pexp_fun (_, _, pat, body) ->
        let param_annotated = match pat.ppat_desc with
          | Ppat_constraint _ -> true
          | _ -> false
        in
        param_annotated && check_params body
    | Pexp_constraint (inner_expr, _typ) ->
        check_params inner_expr
    | _ -> true
  in
  let rec has_return_type_annotation expr =
    match expr.pexp_desc with
    | Pexp_fun (_, _, _, body) -> has_return_type_annotation body
    | Pexp_constraint (_, _return_type) -> true
    | _ -> false
  in
  check_params entry_expr && has_return_type_annotation entry_expr

let banned_always_functions : StringSet.t =
  StringSet.of_list [
    "abs"; "ignore"; "exit"; "truncate"; "Char.code"; "Char.chr";
    "List.map"; "List.mapi"; "List.map2"; "List.fold_left"; "List.fold_right"; "List.iter"; "List.iteri";
    "List.filter"; "List.find"; "List.find_opt"; "List.sort"; "List.stable_sort"; "List.rev_map"; "List.assoc";
    "List.mem"; "List.memq"; "List.combine"; "List.split"; "List.for_all"; "List.exists"; "List.partition";
    "Array.map"; "Array.mapi"; "Array.fold_left"; "Array.fold_right"; "Array.iter"; "Array.iteri";
    "Array.sort"; "Array.stable_sort"; "Array.to_list"; "Array.of_list"; "Array.init"; "Array.make";
    "String.map"; "String.mapi"; "String.iter"; "String.iteri"; "String.concat"; "String.split_on_char";
    "String.sub"; "String.copy"; "String.fill"; "String.blit";
    "Seq.map"; "Seq.filter"; "Seq.fold_left"; "Seq.iter"; "Seq.init"; "Seq.unfold";
    "Stdlib.List.map"; "Stdlib.List.iter"; "Stdlib.Array.map"; "Stdlib.String.concat";
  ]

let banned_mutable_functions : StringSet.t =
  StringSet.of_list [
    "ref"; "Stdlib.ref"; "Pervasives.ref";
    "!"; "Stdlib.!"; "Pervasives.!";
    ":="; "Stdlib.:="; "Pervasives.:=";
    "incr"; "Stdlib.incr"; "Pervasives.incr";
    "decr"; "Stdlib.decr"; "Pervasives.decr";
    "Array.set"; "Stdlib.Array.set";
    "Array.blit"; "Stdlib.Array.blit";
    "Array.fill"; "Stdlib.Array.fill";
    "Bytes.set"; "Stdlib.Bytes.set";
    "Bytes.blit"; "Stdlib.Bytes.blit";
    "Bytes.fill"; "Stdlib.Bytes.fill";
    "Hashtbl.add"; "Hashtbl.remove"; "Hashtbl.replace"; "Hashtbl.clear"; "Hashtbl.reset"; "Hashtbl.create";
    "Queue.push"; "Queue.pop"; "Queue.take"; "Queue.clear"; "Queue.add"; "Queue.create";
    "Stack.push"; "Stack.pop"; "Stack.clear"; "Stack.create";
  ]

let ppx_enforcer_rules =
  object(self)
    inherit Ast_traverse.iter as super
    
    (* Flag to track if we're inside a top-level function definition *)
    val mutable in_toplevel_function = false

    method! structure_item stri =
      match stri.pstr_desc with
      | Pstr_value (rec_flag, bindings) ->
          self#rec_flag rec_flag;
          List.iter (fun vb ->
            self#attributes vb.pvb_attributes;
            self#pattern vb.pvb_pat;

            (* --- Custom Logic for let-bindings --- *)
            let rec is_function_expr expr =
              match expr.pexp_desc with
              | Pexp_fun _ -> true
              | Pexp_constraint (inner_expr, _) -> is_function_expr inner_expr
              | _ -> false
            in

            if is_function_expr vb.pvb_expr then (
              (* This is a top-level function definition. *)
              (* 1. Check for annotations. *)
              if not (all_fun_args_are_annotated vb.pvb_expr) then
                Location.raise_errorf ~loc:vb.pvb_loc
                  "Functions must have type annotations on all parameters and on the return type.";

              (* 2. Set flag and traverse the function expression *)
              in_toplevel_function <- true;
              self#expression vb.pvb_expr;
              in_toplevel_function <- false;
            ) else (
              (* This is not a function definition. *)
              self#expression vb.pvb_expr
            );
            self#location vb.pvb_loc
          ) bindings

      (* For all other kinds of structure items, use the default behavior. *)
      | _ -> super#structure_item stri

    method! expression expr =
      (match expr.pexp_desc with
      | Pexp_for (_, _, _, _, _) when not !allow_for_loops ->
          Location.raise_errorf ~loc:expr.pexp_loc "For-loops are not permitted."
      | Pexp_while (_, _) when not !allow_while_loops ->
          Location.raise_errorf ~loc:expr.pexp_loc "While-loops are not permitted."
      | Pexp_fun (_, _, _, _) when not !allow_lambdas && not in_toplevel_function ->
          Location.raise_errorf ~loc:expr.pexp_loc "Lambda functions (fun keyword in expression context) are not permitted."
      | Pexp_setfield (_, _, _) when not !allow_mutability ->
          Location.raise_errorf ~loc:expr.pexp_loc "Record field mutation (record.field <- value) is not permitted."
      | Pexp_setinstvar (_, _) when not !allow_mutability ->
          Location.raise_errorf ~loc:expr.pexp_loc "Object instance variable mutation (obj#field <- value) is not permitted."
      | Pexp_ifthenelse (_, _, _) ->
          Location.raise_errorf ~loc:expr.pexp_loc "If-then-else statements are not permitted."
      | Pexp_function _ ->
          Location.raise_errorf ~loc:expr.pexp_loc "Single-argument pattern matching with 'function' keyword is not permitted."
      | Pexp_let (Recursive, _, _) ->
          Location.raise_errorf ~loc:expr.pexp_loc "Local recursive definitions (let rec ... in ...) are not permitted."

      | Pexp_ident {txt = longident; loc; _ } ->
          let f_name = Longident.name longident in
          if StringSet.mem f_name banned_always_functions then
            Location.raise_errorf ~loc "Usage of the built-in function/operator '%s' is not permitted." f_name;
          if not !allow_mutability && StringSet.mem f_name banned_mutable_functions then
            Location.raise_errorf ~loc "Usage of the mutable function/operator '%s' is not permitted (-allow_mutability is false)." f_name;
          super#expression expr
      | Pexp_apply ({pexp_desc = Pexp_ident {txt = longident; loc; _}; _}, _) ->
          let f_name = Longident.name longident in
          if StringSet.mem f_name banned_always_functions then
            Location.raise_errorf ~loc "Call to the built-in function/operator '%s' is not permitted." f_name;
          if not !allow_mutability && StringSet.mem f_name banned_mutable_functions then
            Location.raise_errorf ~loc "Call to the mutable function/operator '%s' is not permitted (-allow_mutability is false)." f_name;
          super#expression expr

      | _ -> super#expression expr
      )
  end

let () =
  Driver.add_arg "-allow_for_loops"
    (Set allow_for_loops)
    ~doc:"Allow for-loops to be used.";
  Driver.add_arg "-allow_while_loops"
    (Set allow_while_loops)
    ~doc:"Allow while-loops to be used.";
  Driver.add_arg "-allow_lambdas"
    (Set allow_lambdas)
    ~doc:"Allow lambda functions (fun keyword in expressions) to be used.";
  Driver.add_arg "-allow_mutability"
    (Set allow_mutability)
    ~doc:"Allow mutable operations (refs, array/bytes set, record field mutation).";

  Driver.register_transformation
    ~impl:(fun str ->
      ppx_enforcer_rules#structure str;
      str)
    "ppx_ics_enforcer"