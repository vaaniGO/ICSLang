import * as cp from "child_process";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
// set the env folder
const openrouter_api = process.env.OPENROUTER_API_KEY || "";
const LLMmodel = "deepseek/deepseek-r1:free";
const prompt = "Convert this OCaml code to Dafny code. Do not include any explanations, only return the Dafny code." +
    "Please return it in pure plaintext so that no additiona characters are added while any sort of parsing. Particularly, be careful that no markdown characters come." +
    "DO NOT use markdown.\n\n";
const code = `
(* To sort, we need a comparison function that defines ordering for elements *)
let myCompareFunction (x : 'a) (y : 'a) =
    x >= y (* This can be changed to the desired comparison logic *)
;;

(* Swap elements based on a given comparison function *)
let swap (x : 'a) (y : 'a) (compareFunction : 'a -> 'a -> bool) : 'a * 'a =
    match compareFunction x y with
    | true -> (y, x)
    | false -> (x, y)
;;

(* Given a sorted list, insert a new element in the correct position *)
let rec insert (x : 'a) (sorted : 'a list) (compareFunction : 'a -> 'a -> bool) : 'a list =
    match sorted with
    | [] -> [x]
    | y :: ys ->
        if compareFunction x y then
            y :: insert x ys compareFunction
        else
            x :: sorted
;;

(* Insert each element into its correct position in the sorted part of the list *)
let rec insertion_sort_helper (lst : 'a list) (sorted : 'a list) (compareFunction : 'a -> 'a -> bool) : 'a list =
    match lst with
    | [] -> sorted
    | x :: xs -> insertion_sort_helper xs (insert x sorted compareFunction) compareFunction
;;

let insertion_sort (lst : 'a list) (compareFunction : 'a -> 'a -> bool) : 'a list =
    insertion_sort_helper lst [] compareFunction
;;

(* Example usage *)
let sortedList = insertion_sort [1] myCompareFunction;;
print_endline (String.concat "; " (List.map string_of_int sortedList));;

`;

interface OpenRouterResponse {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
}

// Enable better dafny output logging
function runDafny(code: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const proc = cp.spawn("dafny", ["verify", "--stdin"], { stdio: ["pipe", "pipe", "pipe"] });

        let output = "";
        proc.stdout.on("data", (data) => { output += data.toString(); });
        proc.stderr.on("data", (data) => { output += data.toString(); });

        proc.on("close", (code) => {
            if (code === 0) resolve(output);
            else reject(new Error(output));
        });

        proc.stdin.write(code);
        proc.stdin.end();
    });
}

async function callLLM(code: string): Promise<string> {
    // Check if openrouter_api is defined
    if (!openrouter_api) {
        throw new Error("OpenRouter API key is not defined");
    }

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${openrouter_api}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: LLMmodel, // Updated to a more reliable free model
                messages: [
                    {
                        role: "user",
                        content: prompt + code,
                    },
                ],
                temperature: 0.5, // Lower temperature for more consistent code generation
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const data = await response.json() as OpenRouterResponse;

        // Check if the response has the expected structure
        if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
            throw new Error("Invalid response structure from LLM");
        }

        const output = data.choices[0]?.message?.content?.trim();

        if (!output) {
            throw new Error("No content returned from LLM");
        }

        return output;
    } catch (err) {
        console.error("LLM Error:", err);
        // Re-throw the error instead of returning empty string for better error handling
        throw new Error(`Failed to call LLM: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
}

export async function pipeline(editorText: string) {
    // 1. Send text to LLM
    const llmResponse = await callLLM(editorText);
    console.log("LLM Response:\n", llmResponse);

    // 2. Pass LLM’s response into Dafny
    try {
        const result = await runDafny(llmResponse);
        return result;
    } catch (err) {
        return "Dafny error!";
    }
}

async function test(code: string) {
    try {
        const result = await pipeline(code);
        console.log("Dafny Output:\n", result);
    } catch (err) {
        console.error("Dafny Error!", err);
    }
}

test(code);