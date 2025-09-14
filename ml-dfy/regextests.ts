// Single regex to match OCaml function signatures
const ocamlFunctionRegex = /let\s+(?:rec\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s+\(([a-zA-Z_][a-zA-Z0-9_]*)\s+:\s+([a-zA-Z_][a-zA-Z0-9_]*)\)\s+:\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+=/;

// Test cases
const testCases = [
    "let f : unit =",
    "let rec f x : unit = ",
    "let rec f =",
    "let rec f x : x =",
    "let rec f (x) : (x) ="
];




const functionNameRegex = /([a-zA-Z_][a-zA-Z0-9_]*)/;
const paramRegex = /(\s*\(([^)]*)\)\s*)+/;
const testParam = "(a : int) (b : int) (c : int)";
// const paramMatch = testParam.match(paramRegex);
// if (paramMatch) {
//     console.log(`✓ Match found: ${paramMatch[0]}`);
//     console.log(`  Full match: ${paramMatch[0]}`);
//     console.log(`  Inner match: ${paramMatch[1]}`);
// }
const returnTypeRegex = /([a-zA-Z])/;

const ocamlFunctionRegexFlexible = /let\s+(?:rec\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*(\s*\(([^)]*)\)\s*)+\s*:\s*([^=]+)=/ // this works well
// once this test is passed and we extract params, we want to do another test for params validity, type checking etc. 

// let + space + rec optionally + space + funcrtion name + space + compulsory bracket open


console.log("\nTesting flexible version:");
testCases.forEach((testCase, index) => {
    const match = testCase.match(ocamlFunctionRegexFlexible);
    console.log(`Test ${index + 1}: "${testCase}"`);
    if (match) {
        console.log(`✓ Match found:`);
        console.log(`  Function name: ${match[1]}`);
        console.log(`  Parameter name: ${match[2]}`);
        console.log(`  Parameter type: ${match[3]}`);
        console.log(`  Return type: ${match[4]}`);
    } else {
        console.log(`✗ No match`);
    }
    console.log('---');
});