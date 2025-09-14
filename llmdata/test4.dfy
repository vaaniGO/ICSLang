/**
Fixes I had to make: 
1. weird use of "method function" to declare functions
2. writing just x >= y instead of return x >= y
3. incorrect use of comparison operator > on type T, I changed it to int
4. Otherwise pretty good job i would say
 */

method MyCompareFunction<T(0)>(x: int, y: int) returns (b: bool)
  ensures b == (x >= y)
{
  return x >= y; // weird other-langauge-like behaviour
}

method Swap<T(0)>(x: T, y: T, compareFunction: (T, T) -> bool) returns (a: T, b: T)
  ensures compareFunction(x, y) ==> (a == y && b == x)
  ensures !compareFunction(x, y) ==> (a == x && b == y)
{
  if compareFunction(x, y) {
    a, b := y, x;
  } else {
    a, b := x, y;
  }
}

function Insert<T(0)>(x: T, sorted: seq<T>, compareFunction: (T, T) -> bool): seq<T>
  ensures |sorted| == 0 ==> Insert(x, sorted, compareFunction) == [x]
  ensures |sorted| > 0 ==> 
    (compareFunction(x, sorted[0]) ==> Insert(x, sorted, compareFunction) == [sorted[0]] + Insert(x, sorted[1..], compareFunction))
  ensures |sorted| > 0 ==> 
    (!compareFunction(x, sorted[0]) ==> Insert(x, sorted, compareFunction) == [x] + sorted)
{
  if |sorted| == 0 then
    [x]
  else if compareFunction(x, sorted[0]) then
    [sorted[0]] + Insert(x, sorted[1..], compareFunction)
  else
    [x] + sorted
}

function InsertionSortHelper<T(0)>(lst: seq<T>, sorted: seq<T>, compareFunction: (T, T) -> bool): seq<T>
  ensures |lst| == 0 ==> InsertionSortHelper(lst, sorted, compareFunction) == sorted
  ensures |lst| > 0 ==> InsertionSortHelper(lst, sorted, compareFunction) == 
    InsertionSortHelper(lst[1..], Insert(lst[0], sorted, compareFunction), compareFunction)
{
  if |lst| == 0 then
    sorted
  else
    InsertionSortHelper(lst[1..], Insert(lst[0], sorted, compareFunction), compareFunction)
}

method InsertionSort<T(0)>(lst: seq<T>, compareFunction: (T, T) -> bool) returns (sorted: seq<T>)
  ensures sorted == InsertionSortHelper(lst, [], compareFunction)
{
  sorted := InsertionSortHelper(lst, [], compareFunction);
}