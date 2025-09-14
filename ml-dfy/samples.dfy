function factorial(n: nat): nat
{
  if n == 0 
  then 
  1 
  else 
  n * factorial(n - 1)
}

function power(x: int, n: nat): int
{
  if n == 0 then 1
  else x * power(x, n - 1)
}


function gcd(a: nat, b: nat): nat
decreases b // this could not be verified without suppling this decreases clause
{
  if b == 0 then a else gcd(b, a % b)
}


