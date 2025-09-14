datatype List<T> = Nil | Cons(T, List<T>)

function method swap<T>(x: T, y: T, compareFunction: (T, T) -> bool): (T, T) {
  if compareFunction(x, y) then (y, x) else (x, y)
}

function method insert<T>(x: T, sorted: List<T>, compareFunction: (T, T) -> bool): List<T> {
  match sorted
  case Nil => Cons(x, Nil)
  case Cons(y, ys) =>
    if compareFunction(x, y) then Cons(y, insert(x, ys, compareFunction)) else Cons(x, sorted)
}

function method insertionSortHelper<T>(lst: List<T>, sorted: List<T>, compareFunction: (T, T) -> bool): List<T>
  decreases lst
{
  match lst
  case Nil => sorted
  case Cons(x, xs) => insertionSortHelper(xs, insert(x, sorted, compareFunction), compareFunction)
}

function method insertionSort<T>(lst: List<T>, compareFunction: (T, T) -> bool): List<T> {
  insertionSortHelper(lst, Nil, compareFunction)
}

method Main() {
  var myCompareFunction := (x: int, y: int) => x >= y;
  var sortedList := insertionSort(Cons(1, Cons(3, Cons(2, Nil))), myCompareFunction);
  print sortedList;
}