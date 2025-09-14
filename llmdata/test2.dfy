 function myCompareFunction(x: int, y: int): bool
{
    x > y
}

function swap(x: int, y: int, compareFunction: (int, int) -> bool): (int, int)
{
    if compareFunction(x, y) then (y, x) else (x, y)
}

function pass(lst: seq<int>, index: int): seq<int>
    requires index >= 0
    decreases index
{
    if index == 0 then lst
    else match lst {
        case [] => [] // Initially: invalid SingleExtendedPattern
        case [x] => [x]
        case x + y + xs => 
            var (a, b) := swap(x, y, myCompareFunction);
            [a] + pass([b] + xs, index - 1)
    }
}

function bubble_sort_helper(lst: seq<int>, l: int): seq<int>
    requires l >= 0
    decreases l
{
    if l <= 0 then lst
    else bubble_sort_helper(pass(lst, l), l - 1)
}

function bubble_sort(lst: seq<int>): seq<int>
{
    var length := |lst|;
    if length == 0 then []
    else bubble_sort_helper(lst, length - 1)
}

method Main() {
    var sortedList := bubble_sort([5, 3, 8, 6, 2, 1, 7]);
    print sortedList;
}