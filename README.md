# <span style="color: #3674B5;">B</span><span style="color: #7F55B1;">O</span><span style="color: #ef7f08;">O</span><span style="color: #096B68;">P</span>: How to Right Code!
### A novel problem-solving tool for students of introductory computer science. This is designed to promote structured thinking, strong design choices, self-reflection and a well-probed problem-solving stream.
## Language Syntax

The ICS language syntax is designed to be simple and intuitive, allowing users to write structured documents easily. There are only 5 syntax features to know:

> - **Sections** follow tag-based hierarchy (similar to HTML!).
> 
> - **Main-tags** (intuitively, these are the 'broad' sections) use double angle brackets (`<< >>`).
> 
> - **Sub-tags** (intuitively, these are the sub-sections) use a simple ``` tag_name: ``` format
> - A main-tag MUST have all its sub-tags, even if they are empty. This is to ensure that the document is well-structured and complete.
> - **Comments** are started using `//`. 

## Header Block

Every submission must inlcude a header in the following format. All fields of the header are mandatory.
<div style="text-align: left; margin-left: 5%; ">
<<<span style="color: #e6ea92;">header</span> 

<span style="color: aqua;">assignment</span>: Assignment 5: Sorting & Searching <br>
<span style="color: aqua;">student</span>: Vaani Goenka<br>
<span style="color: aqua;">date</span>: 15th June 2025<br>
<span style="color: aqua;">collaborators</span>: None

<span style="color: #e6ea92;">header</span>>>
</div>


## Syntax in action: <span style="color: #3674B5;">B</span><span style="color: #7F55B1;">O</span><span style="color: #ef7f08;">O</span><span style="color: #096B68;">P</span>!

## 1. Problem Block


<div style="text-align: left; margin-left: 5%; ">

<<<span style="color: aqua;">problem</span> <span style="color: orange;">1</span>: "Title of the Problem"

    ... (all other BOOP blocks go here)

<span style="color: aqua;">problem</span>>>

</div>

> - Every problem must be enclosed within a problem block. Failure to do so might result in a blank submission despite other BOOP tags.
> - 'problem' must be followed by a number, a colon and the title of the problem in double quotes as shown above.
> - Proper error message for the above is in progress.

## 2. Blueprint
This main-section is intended for the user to lay out the correctness criteria of their program i.e. what are the characeteristics (formally) of the input and output that must hold true for the program to be considered correct. 


<div style="text-align: left; margin-left: 5%; ">
<<<span style="color: #e6ea92;">blueprint</span> 

    <span style="color: aqua;">requires</span>: [conditions that must hold before execution] \
    <span style="color: aqua;">ensures</span>: [conditions that must hold after execution]

<span style="color: #e6ea92;">blueprint</span>>>
</div>

## 3. Operational Steps
This section is for the user to explain their algorithm (process) for solving the given problem as if to a human.
<div style="text-align: left; margin-left: 5%; ">
<<<span style="color: #e6ea92;">operational steps</span>

    <span style="color: aqua;">step 1</span>: Considering the base case n=0, we can think of the problem as one....\
    <span style="color: aqua;">step n</span>: We eventually reach n=0 because we are subtracting at every step so the base case....

<span style="color: #e6ea92;">operational steps</span>>>
</div>


## 4. Ocaml Code
Write your standard ICS-friendly OCaml code here. It will be validated by the ICS OCaml validator.
<div style="text-align: left; margin-left: 5%; ">
<<<span style="color: #e6ea92;">ocaml code</span>

    (* Write your code in regular OCaml syntax, following ICS guidelines *) 

<span style="color: #e6ea92;">ocaml code</span>>>
</div>

The status of your code is then reflected in the compiled version as so: 
<img src="https://github.com/vaaniGO/ICSLang/blob/main/compiled_status.png" alt="Validation Error in PDF" width="200px"/>


Errors in your code will appear in a pop-up during compilation, but will not stop compilation. Your submission will be compiled and your pdf will have your code marked as invalid accordinging to ICS syntax..
![Ocaml Error Message](https://github.com/vaaniGO/ICSLang/blob/main/error_msg.png)
<img src="https://github.com/vaaniGO/ICSLang/blob/main/validation_failed.png" alt="Validation Error in PDF" width="200px"/>


## 5. 📖 Proof
This section is intended for the user to provide a complete and formal proof that their program satisfies the given correctness criteria in the blueprint.
### Proof by induction would look like:
<div style="text-align: left; margin-left: 5%; ">
<<<span style="color: #e6ea92;">proof</span> <br>
<<<span style="color: #e6ea92;">induction</span> <br> <br>
<span style="color: aqua;">base case</span>: ... <br> <br>
<span style="color: aqua;">induction hypothesis</span>: ... <br><br>
<span style="color: aqua;">indutive step</span>: ... <br> <br>
<span style="color: #e6ea92;">induction</span>>><br>

<span style="color: #e6ea92;">proof</span>>>
</div>

### Loop invariants would look like:
<div style="text-align: left; margin-left: 5%; ">
<<<span style="color: #e6ea92;">proof</span> <br>
<<<span style="color: #e6ea92;">invariant</span> <br> <br>
<span style="color: aqua;">pre-condition</span>: ... <br> <br>
<span style="color: aqua;">after the ith step</span>: ... <br><br>
<span style="color: aqua;">after the (i+1)th step</span>: ... <br> <br>
<span style="color: aqua;">post-condition</span>: ... <br> <br>
<span style="color: #e6ea92;">invariant</span>>><br>

<span style="color: #e6ea92;">proof</span>>>
</div>


## Usage:
1. Install dependencies in your working folder (Assuming you have opam installed. opam is the package manager for OCaml.)
```bash
opam install dune ocaml odoc ppxlib
```
2. Create your .ics file in your working folder
3. Open the command palette (Cmd+Shift+P on mac or Ctrl+Shift+P on windows)
4. Type ICS
5. Select ICS: Compile ICS 
6. You can view your pdf open in your default browser. Further, a raw html file (with some accompanying css) will be available on ```Desktop/output```. Most users may discard this file if you do not need it.
<h6 style="color: red;">Please note that the dropdown option: 'Compile for assignment #1' is a test option and not relevant to current users!</h6>

## Information for Instructors

### Customisation for compilation
Instructors may modify the file ```src/assignment_1.txt``` (for assignment_1 example) by simply specifying the flags they wish to allow as follows:
```
const allowed_flags = "-allow_for_loops";
```
All allowed flags are: 
```
-allow_for_loops -allow_while_loops -allow_mutability -allow_lambdas
```
By default, none of these are set to allowed.  \
Currently, there is a test command available on opening the command palette saying ```compile for assignment #1```. This applies instructor modifications to ```assignment_1.txt``` effectively in compilation.

<h6> Modifcations to instructor pipeline are in progress. </h6>

_______________________

### Acknowledgements
Thank you to [Prof Aalok D. Thakkar](https://aalok-thakkar.github.io) for his guidance and mentorship. 

### Version Info
Developer and Maintainer: Vaani Goenka vaani.goenka_ug2024@ashoka.edu.in \
Changelog \
0.5.0 \
Second major release \
OCaml code validation \
Instructor discretion to add plugins to customise validation \
Better extension features like collapsing sections \
Better error messages 


