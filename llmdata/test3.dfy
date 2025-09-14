 method Main() {
    var x := 5;
    var i := 1;
    while i <= x
        invariant i <= x + 1
    {
        print(i);
        i := i + 1;
    }
}

/**

Given code: 
let x = 5 in
for i = 1 to x do
  (print_int(i))
done;;

Observations: 
1. Usually does not explicitly write good / sufficient ensures statements and ofc the program can be verified without that too

 */