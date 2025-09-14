function myCompareFunction(x: int, y: int): bool
{
    x > y
}

function swap(x: int, y: int, compareFunction: (int, int) -> bool): (int, int)
{
    if compareFunction(x, y) then (y, x) else (x, y)
}

function pass(lst: seq<int>, index: int): seq<int>
    decreases index
    requires index >= 0 // LLM did not write this line, LLM: DeepSeek
{
    if index == 0 then lst
    else if |lst| == 0 then []
    else if |lst| == 1 then lst
    else
        var x := lst[0];
        var y := lst[1];
        var xs := lst[2..];
        var (a, b) := swap(x, y, myCompareFunction);
        [a] + pass([b] + xs, index - 1)
}

function bubble_sort_helper(lst: seq<int>, l: int): seq<int>
    decreases l
{
    if l <= 0 then lst
    else bubble_sort_helper(pass(lst, l), l - 1)
}

function bubble_sort(lst: seq<int>): seq<int>
{
    var length := |lst|;
    bubble_sort_helper(lst, length - 1)
}

method Main()
{
    var sortedList := bubble_sort([5, 3, 8, 6, 2, 1, 7]);
    print sortedList, "\n";
}