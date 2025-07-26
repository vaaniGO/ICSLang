const allowed_flags = ""; // This must be the very first line. Do not remove it. 
// Basically an array of dictionaries 
// Each dictionary corresponds to one problem
let assignment_info: { [key: string]: string[] | null | string }[] = [];
// These are automatically populated to keep track of allowed features in the current assignment and code. 
// These two are the only global variables needed.

import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

/**
 * Throughout the code, newline handling must be done using \n. The escapeHtml function converts this to <br>. Do not use <br> directly anywhere.
 * All injected text must be escaped first. This prevents injection attacks. 
 */

function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\n/g, "<br>");
}

/**
 * Each class implements Section should have: 
    * 1. Accepting attributes
    * 2. Validity check if the class itself is allowed
    * 3. Parsing 
    * 4. isComplete handling
    * 5. Returning HTML 
    * 6. Validity check if all subsections that are required are there
    * Do not change the interface
 */

export interface Section {
    subsections: { [key: string]: string | string[] | Section } | string[];
    name: string;
    isComplete: boolean;
    getHTML(): string;
    parse(lines: string[]): void | Promise<void>; // Allow async for Ocaml code verification
    accept(...args: any[]): void;
}

class Header implements Section {
    subsections: { [key: string]: string };
    name: string;
    isComplete: boolean;
    assignmentNo: string;

    constructor() {
        this.subsections = {
            Name: "",
            Assignment: "",
            Collaborators: "",
            Date: "",
            Professor: ""
        };
        this.name = "Header";
        this.isComplete = false;
        this.assignmentNo = "";
    }

    checkValidAssignmentNo(): boolean {
        // Since both compiler.ts and assignment_1.json are in ICSLang/src,
        // construct path relative to the current file location
        const assignmentFile = path.join(__dirname, `../src/assignment_${this.assignmentNo}.json`);

        console.log("Looking for assignment file at:", assignmentFile);
        console.log("__dirname is:", __dirname);

        if (!fs.existsSync(assignmentFile)) {
            // Debug: list files in the same directory
            try {
                const files = fs.readdirSync(__dirname);
                console.log("Files in __dirname:", files.filter(f => f.includes('assignment')));
            } catch (err) {
                console.log("Could not read __dirname:", err);
            }

            vscode.window.showErrorMessage(`Assignment file not found at: ${assignmentFile}`);
            return false;
        }
        return true;
    }

    parse(lines: string[]): void {
        // DON'T reset subsections - just reset values
        Object.keys(this.subsections).forEach(key => {
            this.subsections[key] = "";
        });

        let count = 0;
        const requiredKeys = ["Name", "Assignment", "Collaborators", "Date", "Professor"];

        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) continue;

            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();

            if (key && value) {
                // Check if key is expected
                if (!requiredKeys.includes(key)) {
                    vscode.window.showErrorMessage(`Unknown key in Header: ${key}`);
                    return;
                }

                // Check for duplicate keys
                if (this.subsections[key] !== "") {
                    vscode.window.showErrorMessage(`Duplicate key found in Header: ${key}`);
                    return;
                }

                this.subsections[key] = value.trim();
                count++;
            }
        }

        console.log(this.subsections);
        console.log("Count", count);

        // Check if all required fields are filled
        this.isComplete = count === 5;
        console.log("Is complete after parsing", this.isComplete);

        // Extract and validate assignment number
        if (this.subsections.Assignment && this.isComplete) {
            const assignmentMatch = this.subsections.Assignment.match(/(\d+)/);
            this.assignmentNo = assignmentMatch ? assignmentMatch[1] : "";

            if (this.assignmentNo) {
                // Only set isComplete to false if assignment validation fails
                if (!this.checkValidAssignmentNo()) {
                    this.isComplete = false;
                    return;
                }
            } else {
                vscode.window.showErrorMessage("Could not extract assignment number from Assignment field.");
                this.isComplete = false;
                return;
            }
        }

        if (!this.isComplete) {
            const missingFields = requiredKeys.filter(key => this.subsections[key] === "");
            vscode.window.showErrorMessage(
                `Header incomplete. Missing fields: ${missingFields.join(', ')}`
            );
        }

        console.log("Final isComplete", this.isComplete);
    }

    accept(): void { }

    getHTML(): string {
        const { Name, Assignment, Collaborators, Date, Professor } = this.subsections;
        return `
        <div class="header">
            <div class="header-title">
                BOOP! ICS Summer 2025 | Professor <span class="professor-name">${escapeHtml(Professor)}</span>
            </div>
        </div>

        <div class="assignment-header">
            <div class="assignment-name">${escapeHtml(Assignment)}</div>
            <div class="student-name">${escapeHtml(Name)}</div>
            <div class="date">${escapeHtml(Date)}</div>
            <div class="collaborators">${escapeHtml(Collaborators)}</div>
        </div>`;
    }
}

//  The below 3 classes are subsections of the Blueprint class. They are only called by blueprint if they are valid in the problem under consideration.
// This is why they have no validity checks within themselves. Since blueprint is already looping once either ways, we don't want to loop extra inside these classes.

/**
     * Expected format: 
     * <<functional-correctness
     * Requires: <requires clause>
     * Ensures: <ensures clause>
     * functional-correctness>>
 */
class FunctionalCorrectness implements Section {
    subsections: string[];
    name: string;
    isComplete: boolean;
    problemNo: string;

    constructor() {
        this.subsections = ["", "", ""];
        this.name = "Functional Correctness";
        this.isComplete = false;
        this.problemNo = "";
    }

    accept(problemNo: string): void {
        this.problemNo = problemNo.trim();
        // if (!this.isAllowedInProblem()) {
        //     vscode.window.showErrorMessage("Functional Correctness section is not allowed in this problem.");
        //     return;
        // }
    }

    parse(
        lines: string[]
    ): void {
        // In assignment_info, find where "Problem": value matches problemNo, in that object, extract the "Blueprint": value. The value is an array. The array should
        // contain "FunctionalCorrectness"

        const len = lines.length;
        let counter = 0;
        const requiresOpenRegex = /^\s*requires\s*:/i;
        const ensuresOpenRegex = /^\s*ensures\s*:/i;
        for (let i = 0; i < len; i++) {
            const currentLine = lines[i];
            if (requiresOpenRegex.test(currentLine) || ensuresOpenRegex.test(currentLine)) {
                counter++;
                this.subsections[counter] += currentLine.split(':')[1].trim();
            }
            else {
                // For e.g. counter = 0 when we are in 'requires, the moment the subsection switches, count updates and we automatically starts populating the next clause (ensures)
                this.subsections[counter] += "\n" + currentLine;
            }
            // Error handling
            if (counter > 2) {
                vscode.window.showErrorMessage("Functional Correctness section can only have one pair of Requires and Ensures clauses.");
                return;
            }
        }

        this.isComplete = this.subsections[1] && this.subsections[2] ? true : false;
        if (!this.isComplete) {
            vscode.window.showErrorMessage("Functional Correctness section is incomplete. Please fill both Requires and Ensures clauses.");
            return;
        }
    }

    getHTML(): string {
        return `<div class="blueprint-requires sub-section">
                    <span class="blueprint-requires-header">Requires: </span>
                    ${escapeHtml(this.subsections[1])}
                </div>
                <div class="blueprint-ensures sub-section">
                    <span class="blueprint-ensures-header">Ensures: </span> 
                    ${escapeHtml(this.subsections[2])}
                </div>`;
    }
}

/**
     * Expected format: 
     * <<complexity
     *  Time: <time complexity>
     *  Space: <space complexity>
     * complexity>>
 */
class Complexity implements Section {
    subsections: { [key: string]: string };
    name: string;
    isComplete: boolean;
    HTML: string;
    problemNo: string;

    constructor() {
        this.subsections = {
            Time: "",
            Space: ""
        };
        this.name = "Complexity";
        this.isComplete = false;
        this.HTML = "";
        this.problemNo = "";
    }

    accept(
        problemNo: string
    ): void {
        this.problemNo = problemNo.trim();
    }

    // Parses the content of the Complexity section and updates the object fields accordingly
    parse(
        lines: string[]
    ): void {
        let len = lines.length;
        for (let i = 0; i < len; i++) {
            const [key, value] = lines[i].split(':').map(part => part.trim());
            if (key && value) {
                this.subsections[key] = value;
            }
        }
        // Only time complexity is required, the other is optional
        this.isComplete = this.subsections['Time'] != "" ? true : false;
        if (!this.isComplete) {
            vscode.window.showErrorMessage(`Complexity section is incomplete for problem number ${this.problemNo}. Please fill the Time Complexity clause.`);
            return;
        }
    }

    getHTML(): string {
        // This method should be implemented to return the HTML representation of the Complexity section
        return `
            <div class="time-complexity sub-section">
                <span class="blueprint-requires-header">Time Complexity: </span>
                ${escapeHtml(this.subsections.Time)}
            </div>
            <div class="space-complexity sub-section">
                <span class="blueprint-requires-header">Space Complexity: </span>
                ${escapeHtml(this.subsections.Space)}
            </div>`;
    }
}

/**
 * Expected format: 
    * <<Input-Output
    * Input: <input>
    * Output: <output>
    * Input: <another input>
    * Output: <another output>
    * Input-output>>
 */
class InputOutput implements Section {
    subsections: { [key: string]: string[] };
    name: string;
    isComplete: boolean;
    problemNo: string;

    constructor() {
        this.subsections = {
            Input: [],
            Output: []
        };
        this.name = "Input-Output";
        this.isComplete = false;
        this.problemNo = "";
    }

    // Parses the content of the Input-Output section and updates the object fields accordingly
    parse(
        lines: string[]
    ): void {
        const len = lines.length;
        let currentSection = "";
        // We want to ensure that for all 0<i<len, Input[i] and Output[i] are paired, naturally, len(Input) = len(Output)
        for (let i = 0; i < len; i++) {
            const currentLine = lines[i].trim();
            if (currentLine.toLowerCase().includes("input")) {
                // Require that an input must be followed by an output and no duplication.
                if (currentSection == "Input") {
                    vscode.window.showErrorMessage("Input section is violating order.");
                    return;
                }
                currentSection = "Input";
            } else if (currentLine.toLowerCase().includes("output")) {
                // Means either duplicate or it is the first section
                if (currentSection == "Output" || currentSection == "") {
                    vscode.window.showErrorMessage("Output section is violating order.");
                    return;
                }
                currentSection = "Output";
            } else if (currentSection) {
                this.subsections[currentSection].push(currentLine);
            }
        }
        // The only case not handled is for the last Input clause. 
        if (currentSection == "Input") {
            vscode.window.showErrorMessage("Input section is violating order.");
            return;
        }
        // If both subsections are filled, then the input-output section is complete. We don't have to check for equality. That is handled. 
        this.isComplete = this.subsections.Input.length > 0 && this.subsections.Output.length > 0;
    }

    accept(problemNo: string): void {
        this.problemNo = problemNo.trim();
        // Check if the Input-Output section is allowed in the current problem
        // if (!this.isAllowedInProblem()) {
        //     vscode.window.showErrorMessage("Input-Output section is not allowed in this problem.");
        //     return;
        // }
    }

    generate_InputOutput_HTML(): string {
        const len = this.subsections.Input.length;
        // The below error handling is already managed by parse
        // if (len != this.subsections.Output.length) {
        //     vscode.window.showErrorMessage("Every Input must have a corresponding Output and vice versa.");
        //     return "";
        // }
        let HTML = "";
        for (let i = 0; i < len; i++) {
            HTML += `<span class="blueprint-requires-header">Input: </span>  <span class="input-item">${escapeHtml(this.subsections.Input[i])}<br></span>`;
            HTML += `<span class="blueprint-requires-header">Output: </span>  <span class="input-item">${escapeHtml(this.subsections.Output[i])}<br></span>`;
        }
        return HTML;
    }

    getHTML(): string {
        // This method should be implemented to return the HTML representation of the Input-Output section
        return `<div class="blueprint-input-output sub-section">
                    ${this.generate_InputOutput_HTML()}
                </div>`;
    }
}

class Blueprint implements Section {
    subsections: { [key: string]: Section };
    name: string;
    HTML: string;
    isComplete: boolean;
    problemNo: string
    allowed: string[];

    constructor() {
        this.subsections = {
            'FunctionalCorrectness': new FunctionalCorrectness(),
            'Input-Output': new InputOutput(),
            'Complexity': new Complexity(),

        };
        // this.type = "any"; // Type is any unless modified by instructor-given type
        this.name = "Blueprint";
        this.HTML = "";
        this.isComplete = false;
        this.problemNo = "";
        this.allowed = [];
    }

    // This method checks if the Blueprint section is allowed in the current problem
    // It is used to validate the section against the assignment_info data
    // It also populates allowed[] so that we can see allowed and not allowed subsections while parsing 
    // We ensure this is called before parse() so that we can check if the subsections are allowed or not
    isAllowedInProblem(): boolean {
        for (const info of assignment_info) {
            if (info.Number === this.problemNo) {
                if (info.Blueprint == null)
                    this.allowed = [];
                else if (info.Blueprint instanceof Array)
                    this.allowed = info.Blueprint;
                else
                    this.allowed = [info.Blueprint]; // If it is a string, convert to array, although this will never happen!
                return true;
            }
        }
        return false;
    }

    accept(
        problemNo: string
    ): void {
        this.problemNo = problemNo.trim();
        if (!this.isAllowedInProblem()) {
            vscode.window.showErrorMessage(`Blueprint is not allowed for problem ${this.problemNo}.`);
            return;
        }
    }

    /**
     * The new format of writing blueprint is: 
     * <<bluerpint
     * <<functional-correctness
     * Requires: <requires clause>
     * Ensures: <ensures clause>
     * functional-correctness>>
     * 
     * <<input-output
     * Input: <input>
     * Output: <output>
     * Input: <another input>
     * Output: <another output>
     * input-output>>
     * 
     * <<complexity
     * Time: <time complexity>
     * Space: <space complexity>
     * complexity>>
     * blueprint>>
     * 
     * Which of these are required / not required is on instructor discretion.
     */
    parse(
        lines: string[]
    ): void {
        if (!this.allowed) {
            vscode.window.showErrorMessage("Blueprint object not initialised properly!");
            return;
        }
        let len = lines.length;
        const fcOpenRegex = /<<\s*functional-correctness\s*/i;
        const InputOutputOpenRegex = /<<\s*input-output\s*/i;
        const complexityOpenRegex = /<<\s*complexity\s*/i;
        const fcCoseRegex = /^\s*functional-correctness\s*>>$/i;
        const InputOutputCloseRegex = /^\s*input-output\s*>>$/i;
        const complexityCloseRegex = /^\s*complexity\s*>>$/i;

        for (let i = 0; i < len; i++) {
            let currentLine = lines[i];
            let currentLineLower = currentLine.toLowerCase().trim();
            // Check if the line starts with a keyword. If it does, create an object of the required section and let the class handle the rest
            if (fcOpenRegex.test(currentLineLower)) {
                if (!this.allowed.includes("FunctionalCorrectness")) {
                    vscode.window.showErrorMessage("Functional Correctness section is not allowed in this problem.");
                    return;
                }
                let FunctionalCorrectnessContent = [];
                let FunctionalCorrectnessClosed = false;
                let j = i;
                for (j = i + 1; j < len; j++) {
                    if (fcCoseRegex.test(lines[j].toLowerCase())) {
                        FunctionalCorrectnessClosed = true;
                        break;
                    }
                    // We don't need the closing tag line
                    // Assuming the closing tag always comes on the next line of  the last line in the section
                    FunctionalCorrectnessContent.push(lines[j]);
                }
                if (FunctionalCorrectnessClosed) {
                    this.subsections['FunctionalCorrectness'].parse(FunctionalCorrectnessContent);
                    i = j; // Skip the lines that were parsed
                    this.HTML += this.subsections['FunctionalCorrectness'].getHTML() + "\n";
                }
                else {
                    vscode.window.showErrorMessage("Functional Correctness section is not closed properly.");
                    return;
                }
            }
            else if (InputOutputOpenRegex.test(currentLineLower)) {
                if (!this.allowed.includes("Input-Output")) {
                    vscode.window.showErrorMessage("Input-Output section is not allowed in this problem.");
                    return;
                }
                let InputOutput_content = [];
                let InputOutput_closed = false;
                let j = i;
                for (j = i + 1; j < len; j++) {
                    if (InputOutputCloseRegex.test(lines[j].toLowerCase())) {
                        InputOutput_closed = true;
                        break;
                    }
                    InputOutput_content.push(lines[j]);
                }
                if (InputOutput_closed) {
                    this.subsections['Input-Output'].accept(this.problemNo);
                    this.subsections['Input-Output'].parse(InputOutput_content);
                    i = j;
                    this.HTML += this.subsections['Input-Output'].getHTML() + "\n";
                } else {
                    vscode.window.showErrorMessage("Input-Output section is not closed properly.");
                    return;
                }
            }
            else if (complexityOpenRegex.test(currentLineLower)) {
                if (!this.allowed.includes("Complexity")) {
                    vscode.window.showErrorMessage("Complexity section is not allowed in this problem.");
                    return;
                }
                let complexityContent = [];
                let complexityClosed = false;
                let j = i;
                for (j = i + 1; j < len; j++) {
                    if (complexityCloseRegex.test(lines[j].toLowerCase())) {
                        complexityClosed = true;
                        break;
                    }
                    complexityContent.push(lines[j]);
                }
                if (complexityClosed) {
                    this.subsections['Complexity'].accept(this.problemNo);
                    this.subsections['Complexity'].parse(complexityContent);
                    i = j;
                    this.HTML += this.subsections['Complexity'].getHTML() + "\n";
                } else {
                    vscode.window.showErrorMessage("Complexity section is not closed properly.");
                    return;
                }
            }
        }
        this.checkRequirements();
    }

    // Check if any required section is missing. The check for whether blueprint itself is allowed is handled separetely in accept(). Called by parse()
    checkRequirements(): void {
        const problemInfo = assignment_info.find(info => info.Number === this.problemNo);
        const blueprintRequirements = problemInfo?.Blueprint || [];

        // Only iterate if blueprintRequirements is an array
        if (Array.isArray(blueprintRequirements)) {
            for (let requirement of blueprintRequirements) {
                if (!this.subsections[requirement] || !this.subsections[requirement].isComplete) {
                    vscode.window.showErrorMessage(`Blueprint requirement ${requirement} is not complete or missing.`);
                    this.isComplete = false;
                    return;
                }
            }
        }
        this.isComplete = true;
    }

    getHTML(): string {
        // This method should be implemented to return the HTML representation of the Blueprint section
        // No need to escape HTML here as this.HTML contains purely the other classes' generated HTML which are already escaped
        return `<div class="section"> <div class="blueprint">
        <div class="section-header blueprint-header">BLUEPRINT</div>
        ${this.HTML}
                </div>
                </div>`;
    }
}

class OperationalSteps implements Section {
    subsections: { [key: string]: string[] };
    name: string;
    isComplete: boolean;
    problemNo: string;

    constructor() {
        this.subsections = {
            Steps: []
        };
        this.name = "Operational Steps";
        this.isComplete = false;
        this.problemNo = "";
    }

    isAllowedInProblem(): boolean {
        // Check if the Operational Steps section is allowed in the current problem
        for (const info of assignment_info) {
            if (info.Number === this.problemNo) {
                return "Operational Steps" in info;
            }
        }
        return false;
    }
    // Parses a given set of lines and populates the object field
    // The input is expected to be an array of strings, each representing a line in the Operational Steps section
    parse(
        lines: string[]
    ): void {
        console.log(`Parsing Operational Steps in problem ${this.problemNo} section with lines:`, lines);
        const stepMatchRegex = /^\s*step\s*\d*\s*:\s*(.*)$/i;
        let len = lines.length;
        this.isComplete = len > 0;
        let currentStep: number = -1;
        for (let i = 0; i < len; i++) {
            let currentLine = lines[i];
            // Every line is either the opening of a new step, or a continuation of the previous step
            if (stepMatchRegex.test(currentLine)) {
                currentStep++;
                currentLine = currentLine.split(":")[1]; // In the lines containing a step opening extract rest of the line
                this.subsections.Steps[currentStep] = currentLine;
            }
            else this.subsections.Steps[currentStep] += "\n" + currentLine; // Else append the original line
        }
    }

    // This method is not used currently because ops does not have any attributes like title, no.
    accept(problemNo: string): void {
        this.problemNo = problemNo.trim();
        if (!this.isAllowedInProblem()) {
            vscode.window.showErrorMessage(`Operational Steps section is not allowed for problem ${this.problemNo}.`);
            return;
        }
    }

    // This method generates HTML for a single step, with the step number
    getStepHTML(step: string, index: number): string {
        return `<div class="step" id="step-${index}" >
                    <span class="step-number">Step ${index + 1}:</span>
                    <span class="step-content">${escapeHtml(step)}</span>
                </div>`;
    }

    getHTML(): string {
        // Generate HTML for all steps
        const stepsHTML = this.subsections.Steps.map((step, index) => this.getStepHTML(step, index)).join("");
        return `<div class="section">
        <div class="operational-steps">
                    <div class="operational-steps-content sub-section">
                        <div class="operational-steps-header section-header">STEPS</div>`
            + stepsHTML +
            `</div></div></div>`;
    }
}

class OcamlCode implements Section {
    subsections: { [key: string]: string };
    name: string;
    isComplete: boolean;
    problemNo: string;

    constructor() {
        this.subsections = {
            Code: "",
            Status: ""
        };
        this.name = "Code";
        this.isComplete = false;
        this.problemNo = "";
    }

    isAllowedInProblem(): boolean {
        // Check if the Code section is allowed in the current problem
        for (const info of assignment_info) {
            if (info.Number === this.problemNo) {
                return "Ocaml Code" in info;
            }
        }
        return false;
    }

    // Unused and empty function because the code field does not have any attributes like title, no. 
    accept(
        problemNo: string
    ): void {
        this.problemNo = problemNo.trim();
        if (!this.isAllowedInProblem()) {
            vscode.window.showErrorMessage(`Code section is not allowed for problem ${this.problemNo}.`);
            return;
        }
    }
    // Sets the code content for the object and sends it to verify which verifies it and sets the status accordingly.
    async parse(
        codeLines: string[]
    ): Promise<void> {
        this.subsections.Code = codeLines.join("\n").trim();
        // If the code is not empty, then the section is complete
        this.isComplete = this.subsections.Code.length > 0;
        await this.ocamlVerify();
    }
    // Updates the 'status' subsection appropriately based on the status of the code.
    // Assumes that the code content has already been populated
    async ocamlVerify(): Promise<void> {
        const ppxDir = path.resolve(__dirname, '../../ICSLang/ppx_1');
        const tempDir = ppxDir;
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const tempFile = path.join(ppxDir, `section_${randomBytes(8).toString('hex')}.ml`);
        fs.writeFileSync(tempFile, this.subsections.Code, 'utf8');

        try {
            const execAsync = promisify(exec);
            const result = await execAsync(`eval $(opam env)
            dune exec ./bin/checker.exe -- ${tempFile} ${allowed_flags}`, {
                encoding: 'utf-8',
                cwd: ppxDir
            });
            this.subsections.Status = "ICS Verified";
        } catch (err: any) {
            console.error(err.stderr || err.message);
            this.subsections.Status = "ICS Failed";
            vscode.window.showErrorMessage(`🐫 OOPSCaml! ERROR`);
        } finally {
            // Delete the temporary file
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
    }

    getHTML(): string {
        // This method should be implemented to return the HTML representation of the Code section
        return `<div class="section">
                <div class="ocaml-code-header section-header">OCAML CODE</div>
                <div class="ocaml-code">
                <div class="code-status>${this.subsections.Status}</div>
                    <div class="code sub-section">
                        <pre class="line-numbers"><code class="language-ocaml">
                        ${escapeHtml(this.subsections.Code)}</code></pre>
                    </div>
                </div>
            </div>`;
    }
}

class Induction implements Section {
    subsections: { [key: string]: string };
    name: string;
    isComplete: boolean;

    constructor() {
        this.subsections = {
            BaseCase: "",
            InductiveHypothesis: "",
            InductiveStep: ""
        };
        this.name = "Induction";
        this.isComplete = false;
    }

    // Parses lines to populate the subsection fields of the object
    parse(
        lines: string[]
    ): void {
        console.log("Begun parsing induction", lines);
        // This method parses the content of the Induction section
        const len = lines.length;
        const baseCaseRegex = /^\s*base\s*case\s*:\s*(.*)$/i;
        const inductiveHypothesisRegex = /^\s*inductive\s*hypothesis\s*:\s*(.*)$/i;
        const inductiveStepRegex = /^\s*inductive\s*step\s*:\s*(.*)$/i;
        let prevKey = "";

        for (let i = 0; i < len; i++) {
            const currentLine = lines[i];
            if (baseCaseRegex.test(currentLine)) {
                console.log("Base case matched!");
                this.subsections.BaseCase = currentLine.split(':')[1].trim();
                // Ensure that Base Case comes first
                if (prevKey !== "") {
                    vscode.window.showErrorMessage("Base Case must come first.");
                    return;
                }
                prevKey = "BaseCase"; // Keep track of the last key to ensure order
            } else if (inductiveHypothesisRegex.test(currentLine)) {
                console.log("Inductive hypothesis matched!");
                this.subsections.InductiveHypothesis = currentLine.split(':')[1].trim();
                // Ensure that Inductive Hypothesis comes after Base Case
                if (prevKey !== "BaseCase") {
                    vscode.window.showErrorMessage("Inductive Hypothesis must come after Base Case.");
                    return;
                }
                prevKey = "InductiveHypothesis";
            } else if (inductiveStepRegex.test(currentLine)) {
                console.log("Inductive step matched!");
                this.subsections.InductiveStep = currentLine.split(':')[1].trim();
                // Ensure that Inductive Step comes after Inductive Hypothesis
                if (prevKey !== "InductiveHypothesis") {
                    vscode.window.showErrorMessage("Inductive Step must come after Inductive Hypothesis.");
                    return;
                }
                prevKey = "InductiveStep";
            } else if (currentLine.trim() != "") {
                this.subsections[prevKey] += "\n" + currentLine.trim(); // Append the current line to the last key
            }
        }
        console.log("Base case made: ", this.subsections.BaseCase);
        console.log("Inductive hypothesis made: ", this.subsections.InductiveHypothesis);
        console.log("Inductive step made: ", this.subsections.InductiveStep);
        // If all subsections are filled, then the induction section is complete
        this.isComplete = [this.subsections.BaseCase, this.subsections.InductiveHypothesis, this.subsections.InductiveStep]
            .every(s => s.trim().length > 0);
        if (!this.isComplete) {
            vscode.window.showErrorMessage("Induction section is incomplete.");
            return;
        }
    }

    // The below function is not currently used.
    accept(): void { }

    getHTML(): string {
        // This method should be implemented to return the HTML representation of the Induction section
        return `
                <div class="invariant-header section-header">INDUCTION</div>
                <div class="induction">
                    <div class="base-case sub-section">
                        <span class="proof-sub-header">Base Case: </span>
                        ${escapeHtml(this.subsections.BaseCase)}
                    </div>
                    <div class="inductive-hypothesis sub-section">
                        <span class="proof-sub-header">Inductive Hypothesis: </span> 
                        ${escapeHtml(this.subsections.InductiveHypothesis)}
                    </div>
                    <div class="inductive-step sub-section">
                        <span class="proof-sub-header">Inductive Step: </span> 
                        ${escapeHtml(this.subsections.InductiveStep)}
                    </div>
                </div>
            `;
    }
}

class Invariant implements Section {
    subsections: { [key: string]: string };
    name: string;
    isComplete: boolean;

    constructor() {
        this.subsections = {
            Initialisation: "",
            Maintenance: "",
            Termination: ""
        };
        this.name = "Invariant";
        this.isComplete = false;
    }

    // The below function parses lines to populate the subsection fields of the object
    parse(
        lines: string[]
    ): void {
        console.log("Begun parsing invariant");
        // This method parses the content of the Invariant section
        const len = lines.length;
        const initialisationRegex = /^\s*initialisation\s*:\s*(.*)$/i;
        const maintenanceRegex = /^\s*maintenance\s*:\s*(.*)$/i;
        const terminationRegex = /^\s*termination\s*:\s*(.*)$/i;
        let prevKey = "";
        for (let i = 0; i < len; i++) {
            const currentLine = lines[i];
            if (initialisationRegex.test(currentLine)) {
                this.subsections.Initialisation = currentLine.split(':')[1].trim();
                // Ensure that Initialisation comes first
                if (prevKey !== "") {
                    vscode.window.showErrorMessage("Initialisation must come first.");
                    return;
                }
                prevKey = "Initialisation"; // Keep track of the last key to ensure order
            } else if (maintenanceRegex.test(currentLine)) {
                this.subsections.Maintenance = currentLine.split(':')[1].trim();
                // Ensure that Maintenance comes after Initialisation
                if (prevKey !== "Initialisation") {
                    vscode.window.showErrorMessage("Maintenance must come after Initialisation.");
                    return;
                }
                prevKey = "Maintenance";
            } else if (terminationRegex.test(currentLine)) {
                this.subsections.Termination = currentLine.split(':')[1].trim();
                // Ensure that Termination comes after Maintenance
                if (prevKey !== "Maintenance") {
                    vscode.window.showErrorMessage("Termination must come after Maintenance.");
                    return;
                }
                prevKey = "Termination";
            } else {
                this.subsections[prevKey] += "\n" + currentLine.trim(); // Append the current line to the last key
            }
        }
        // If all subsections are filled, then the invariant section is complete
        this.isComplete = [this.subsections.Initialisation, this.subsections.Maintenance, this.subsections.Termination]
            .every(s => s.trim().length > 0);

        if (!this.isComplete) {
            vscode.window.showErrorMessage("Invariant section is incomplete.");
            return;
        }
    }

    // The below function is not currently used
    accept(): void { }

    getHTML(): string {
        // This method should be implemented to return the HTML representation of the Invariant section
        return `
                <div class="invariant-header section-header">INVARIANT</div>
                <div class="invariant">
                    <div class="invariant initialisation sub-section">
                        <span class="proof-sub-header">Invariant Statement: </span> 
                        ${escapeHtml(this.subsections.Initialisation)}
                    </div>
                    <div class="invariant maintenance sub-section">
                        <span class="proof-sub-header">Maintenance: </span> 
                        ${escapeHtml(this.subsections.Maintenance)}
                    </div>
                    <div class="invariant termination sub-section">
                        <span class="proof-sub-header">Termination: </span> 
                        ${escapeHtml(this.subsections.Termination)}
                    </div>
                </div>
            `;
    }
}

// Includes support for a helper proof, proof with title, proof with induction, proof with loop invariant
class Proof implements Section {
    subsections: { [key: string]: Section };
    name: string;
    isComplete: boolean;
    isHelper: boolean = false;
    title: string = "";
    HTML: string;
    problemNo: string;

    constructor() {
        this.subsections = {
            Induction: new Induction(),
            Invariant: new Invariant()
        };
        this.name = "Proof";
        this.isComplete = false;
        this.HTML = "";
        this.problemNo = "";
    }

    // This method checks if the Proof section is allowed in the current problem
    isAllowedInProblem(): boolean {
        // Check if the Proof section is allowed in the current problem
        for (const info of assignment_info) {
            if (info.Number === this.problemNo) {
                // It is okay if Proof is null as long as "Proof" is there as a key.
                return "Proof" in info;
            }
        }
        return false;
    }

    // Populates the two basic (and optional for the user) fields of the Proof section
    accept(
        isHelper: boolean,
        title: string,
        problemNo: string
    ): void {
        this.isHelper = isHelper;
        this.title = title;
        this.problemNo = problemNo.trim();
        console.log("Accepted info for proof in problem", this.problemNo);
        if (!this.isAllowedInProblem()) {
            vscode.window.showErrorMessage(`Proof section is not allowed for problem ${this.problemNo}.`);
            return;
        }
    }

    parse(
        lines: string[]
    ): void {
        const inductionOpenRegex = /<<\s*induction\s*/i;
        const inductionCloseRegex = /^\s*induction\s*>>$/i;
        const invariantOpenRegex = /<<\s*invariant\s*/i;
        const invariantCloseRegex = /^\s*invariant\s*>>$/i;
        const len = lines.length;

        for (let i = 0; i < len; i++) {
            const currentLine = lines[i];
            // Parse the content of each subsection based on the line
            if (inductionOpenRegex.test(currentLine)) {
                //Iterate to find the closing tag
                const inductionContent: string[] = []
                let inductionClosed = false;
                let j = i;
                for (j = i + 1; j < len; j++) {

                    if (inductionCloseRegex.test(lines[j])) {
                        inductionClosed = true;
                        break;
                    }
                    inductionContent.push(lines[j]);
                }
                if (inductionClosed) {
                    this.subsections.Induction.parse(inductionContent);
                    i = j;
                } else {
                    vscode.window.showErrorMessage("Induction section is not closed properly.");
                }
            }
            else if (invariantOpenRegex.test(currentLine)) {
                //Iterate to find the closing tag
                const invariantContent: string[] = [];
                let invariantClosed = false;
                let j = i;
                for (j = i + 1; j < len; j++) {
                    if (invariantCloseRegex.test(lines[j])) {
                        invariantClosed = true;
                        break;
                    }
                    invariantContent.push(lines[j]);
                }
                if (invariantClosed) {
                    this.subsections.Invariant.parse(invariantContent);
                    i = j; // Skip the lines that were parsed
                } else {
                    vscode.window.showErrorMessage("Invariant section is not closed properly.");
                }
            }
        }
        this.isComplete = this.subsections.Induction.isComplete || this.subsections.Invariant.isComplete;
        if (!this.isComplete) {
            vscode.window.showErrorMessage("Proof section is incomplete. Please fill either Induction or Invariant section.");
            return;
        }
    }

    getHTML(): string {
        let subsectionHTML = "";
        if (this.subsections.Induction.isComplete) {
            subsectionHTML = this.subsections.Induction.getHTML();
        } else if (this.subsections.Invariant.isComplete) {
            subsectionHTML = this.subsections.Invariant.getHTML();
        } else {
            return "";
        }

        return `<div class="section">
        <div class="proof-header section-header">PROOF</div>
        <div class="proof">
            <div class="proof-content sub-section">
                ${subsectionHTML}
            </div>
        </div>
    </div>`;
    }

}

class TextAnswer implements Section {
    subsections: { [key: string]: string };
    name: string;
    title: string;
    isComplete: boolean;
    problemNo: string;

    constructor() {
        this.subsections = {
            Answer: ""
        };
        this.name = "Text Answer";
        this.title = "";
        this.isComplete = false;
        this.problemNo = "";
    }

    // This method checks if the Text Answer section is allowed in the current problem
    isAllowedInProblem(): boolean {
        // Check if the Text Answer section is allowed in the current problem
        for (const info of assignment_info) {
            if (info.Number === this.problemNo) {
                return "Text Answer" in info;
            }
        }
        return false;
    }

    // Accepts the title and updates the object fields accordingly
    accept(
        title: string,
        problemNo: string
    ): void {
        this.title = title.trim();
        this.problemNo = problemNo.trim();
        if (!this.isAllowedInProblem()) {
            vscode.window.showErrorMessage(`Text Answer section is not allowed for problem ${this.problemNo}.`);
            return;
        }
    }

    parse(
        lines: string[]
    ): void {
        if (this.title.length == 0) {
            vscode.window.showErrorMessage("Text Answer section must have a title.");
            return;
        }
        // This method parses the content of the Text Answer section
        this.subsections.Answer = lines.join("\n").trim();
        // If the answer is not empty, then the section is complete
        this.isComplete = this.subsections.Answer.length > 0;
    }

    getHTML(): string {
        // This method should be implemented to return the HTML representation of the Text Answer section
        return `<div class="section">
                <div class="text-answer-header section-header">TEXT ANSWER</div>
                <div class="text-answer">
                    <div class="text-answer-content sub-section">
                        ${escapeHtml(this.subsections.Answer)}
                    </div>
                </div>
            </div>`;
    }
}

/**
 * Optional sections depending on instructor discretion: 
 * (1) Blueprint
 * (2) Operational Steps
 * (3) OCaml Code
 * (4) Proof
 * (5) Text Answer 
 */
class Problem implements Section {
    subsections: { [key: string]: Section };
    name: string;
    title: string;
    problemNo: string;
    isComplete: boolean;
    HTML: string;
    // Right now we are not having a Section[] for Proof / Text Answer so we generate on the go
    // But in the future it is suggested to maintain Section[] for Proof and Text Answer
    proofHTML: string;
    TextAnswerHTML: string;

    constructor() {
        this.subsections = {
            Blueprint: new Blueprint(),
            OperationalSteps: new OperationalSteps(),
            Code: new OcamlCode(),
            Proof: new Proof(),
            Complexity: new Complexity(),
            TextAnswer: new TextAnswer()
        };
        this.name = "Problem";
        this.isComplete = false;
        this.proofHTML = "";
        this.TextAnswerHTML = "";
        this.title = "";
        this.problemNo = "";
        this.HTML = "";
    }

    checkValidProblemNo() {
        console.log("Checking against problem No", this.problemNo);
        // Check if the problem number is valid
        if (!this.problemNo || this.problemNo.trim().length === 0) {
            vscode.window.showErrorMessage("Problem number is not set or is empty.");
            return false;
        }
        // Check if the problem number exists in the assignment_info
        const problemInfo = assignment_info.find(info => info.Number === this.problemNo);
        //print all the info.Number values found in assignment_info
        for (let info of assignment_info) {
        }
        if (!problemInfo) {
            vscode.window.showErrorMessage(`Problem number ${this.problemNo} does not exist in the assignment info. Make sure to use the exact problem number only.`);
            return false;
        }
        return true;
    }

    // This method parses the content of the Problem section, updates the objects of its subsections and the boolean to indicate whether the problem is complete
    parse(
        lines: string[]
    ): void {
        const blueprintOpenRegex = /<<\s*blueprint\s*/i;
        const bluePrintCloseRegex = /^\s*blueprint\s*>>$/i;
        const operationalStepsOpenRegex = /<<\s*operational-steps\s*/i;
        const operationalStepsCloseRegex = /^\s*operational-steps\s*>>$/i;
        const codeOpenRegex = /<<\s*ocaml-code\s*/i;
        const codeCloseRegex = /^\s*ocaml-code\s*>>$/i;
        const proofOpenRegex = /<<\s*proof\s*/i;
        const proofCloseRegex = /^\s*proof\s*>>$/i;
        const TextAnswerOpenRegex = /<<\s*text-answer\s*/i;
        const TextAnswerCloseRegex = /^\s*text-answer\s*>>$/i;
        const len = lines.length;

        for (let i = 0; i < len; i++) {
            const currentLine = lines[i];
            // Parse the content of each subsection based on the line
            // Blueprint only appears once in every problem
            if (blueprintOpenRegex.test(currentLine)) {
                if (this.subsections.Blueprint.isComplete) {
                    vscode.window.showErrorMessage("Blueprint section is allowed only once. Put all subsections in one section");
                    return;
                }
                //Iterate to find the closing tag
                const blueprintContent: string[] = [];
                let blueprintClosed = false;
                for (let j = i + 1; j < len; j++) {
                    if (bluePrintCloseRegex.test(lines[j])) {
                        blueprintClosed = true;
                        break;
                    }
                    blueprintContent.push(lines[j]);
                }
                if (blueprintClosed) {
                    const blueprint = new Blueprint();
                    blueprint.accept(this.problemNo);
                    blueprint.parse(blueprintContent);
                    this.subsections.Blueprint = blueprint;
                    this.HTML += this.subsections.Blueprint.getHTML() + "\n";
                } else {
                    vscode.window.showErrorMessage("Blueprint section is not closed properly.");
                }

            }
            // Operational Steps only appears once in every problem
            else if (operationalStepsOpenRegex.test(currentLine)) {
                if (this.subsections.OperationalSteps.isComplete) {
                    vscode.window.showErrorMessage("Operational Steps section allowed only once");
                    return;
                }

                const operationalStepsContent: string[] = [];
                let operationalStepsClosed = false;
                let j = i;
                for (j = i + 1; j < len; j++) {
                    if (operationalStepsCloseRegex.test(lines[j])) {
                        operationalStepsClosed = true;
                        break;
                    }
                    operationalStepsContent.push(lines[j]);
                }

                if (operationalStepsClosed) {
                    this.subsections.OperationalSteps.accept(this.problemNo);
                    this.subsections.OperationalSteps.parse(operationalStepsContent); // FIX: Use parse, not accept
                    i = j;
                    this.HTML += this.subsections.OperationalSteps.getHTML() + "\n";
                } else {
                    vscode.window.showErrorMessage("Operational Steps section not closed properly.");
                }
            }
            // Ocaml code only appears once in every problem
            else if (codeOpenRegex.test(currentLine)) {
                if (this.subsections.Code.isComplete) {
                    vscode.window.showErrorMessage("OCaml Code section is allowed only once. Put all code in one section");
                    return;
                }
                //Iterate to find the closing tag
                const codeContent: string[] = [];
                let codeClosed = false;
                let j = i;
                for (j = i + 1; j < len; j++) {
                    if (codeCloseRegex.test(lines[j])) {
                        codeClosed = true;
                        break;
                    }
                    codeContent.push(lines[j]);
                }
                if (codeClosed) {
                    const code = this.subsections.Code;
                    code.accept(this.problemNo);
                    code.parse(codeContent);
                    i = j;
                    this.HTML += code.getHTML() + "\n";
                } else {
                    vscode.window.showErrorMessage("OCaml Code section is not closed properly.");
                }

            }
            // Multiple proofs can be written in one problem
            else if (proofOpenRegex.test(currentLine)) {
                //Iterate to find the closing tag
                const proofContent: string[] = [];
                let proofClosed = false;
                let j = i;
                for (j = i + 1; j < len; j++) {
                    if (proofCloseRegex.test(lines[j])) {
                        proofClosed = true;
                        break;
                    }
                    proofContent.push(lines[j]);
                }
                if (proofClosed) {
                    const proof = this.subsections.Proof;
                    // Check if the proof is a helper proof
                    const isHelper = currentLine.includes("helper");
                    const titleMatch = currentLine.match(/<<\s*proof\s*:\s*(.*)\s*>>/i);
                    const title = titleMatch ? titleMatch[1].trim() : "";
                    proof.accept(isHelper, title, this.problemNo);
                    proof.parse(proofContent);
                    // Since we aren't keeping track of multiple proof objects, we collate the HTML as we go
                    this.proofHTML += proof.getHTML() + "\n";
                    i = j;
                    // Add the proof HTML to the main HTML
                    this.HTML += this.proofHTML;
                } else {
                    vscode.window.showErrorMessage("Proof section is not closed properly.");
                }
            }
            else if (TextAnswerOpenRegex.test(currentLine)) {
                //Iterate to find the closing tag
                const TextAnswerContent: string[] = [];
                let TextAnswerClosed = false;
                // Extract the title 
                const titleMatch = currentLine.match(/<<\s*text-answer\s*\s*(.*)\s*/i);
                const title = titleMatch ? titleMatch[1].trim() : "";
                let j = i;
                for (j = i + 1; j < len; j++) {
                    if (TextAnswerCloseRegex.test(lines[j])) {
                        TextAnswerClosed = true;
                        break;
                    }
                    TextAnswerContent.push(lines[j]);
                }
                if (TextAnswerClosed) {
                    this.subsections.TextAnswer.accept(title, this.problemNo);
                    this.subsections.TextAnswer.parse(TextAnswerContent);
                    i = j;
                    // Since we aren't keeping track of multiple text answer objects, we collate the HTML as we go
                    this.TextAnswerHTML += this.subsections.TextAnswer.getHTML() + "\n";
                    // Add the Text Answer HTML to the main HTML
                    this.HTML += this.TextAnswerHTML;
                } else {
                    vscode.window.showErrorMessage("Text Answer section is not closed properly.");
                }
            }
        }

        this.isComplete = true;
    }

    accept(
        title: string,
        problemNo: string,
    ): void {
        this.title = title.trim();
        this.problemNo = problemNo.trim();
        this.checkValidProblemNo();
    }

    getHTML(): string {
        // This method should be implemented to return the HTML representation of the Problem section
        return `<div class="problem">
                    <div class="problem-title">${this.problemNo}: ${this.title}</div>
                    ${this.HTML}
                </div>`;
    }
}

class Document {
    header = new Header();
    assignmentNumber: string;
    problems: Problem[];
    isComplete: boolean;
    HTML: string;

    constructor() {
        this.header = new Header();
        this.problems = [];
        this.isComplete = false;
        this.HTML = "";
        this.assignmentNumber = "";
    }

    // Adds a new problem to the document
    // Do not worry about HTML generation right now, HTML generation is only done in getHTML
    // An alternative is to generate as you go
    // The title and problemNo is updated before sending it to Doc. It is updated in parse in ICSCompiler.
    addProblem(problem: Problem): void {
        this.problems.push(problem);
        this.isComplete = this.isComplete && problem.isComplete;
    }

    // Parse the JSON, make a structured dictionary with assignment info
    addAssignmentCriteria(): void {
        const jsonFile = path.join(__dirname, `../../ICSLang/src/assignment_${this.assignmentNumber}.json`);
        const rawData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

        // Iterate over each problem in the Problems array
        for (const problem of rawData.Problems) {
            // Create a new dictionary for this problem
            const problemDict: { [key: string]: string[] | null | string } = {};

            // Iterate over all properties of the current problem
            for (const [key, value] of Object.entries(problem)) {
                problemDict[key] = value as string[] | null | string;
            }

            // Add the problem dictionary to assignment_info
            assignment_info.push(problemDict);
        }
        console.log("Added assignment criteria!");

    }

    private generateCSS(): string {
        return `  
        :root {
            --blue: #3674B5;
            --purple: #7F55B1;
            --orange: #ef7f08;
            --green: #096B68;
        }

        * {
            font-family: cm ss10, sans-serif;
        }

        body {
            display: flex;
            flex-direction: column;
            font-weight: 550;
            margin: 20px;
        }

        .assignment-name {
            font-size: 32px;
            font-weight: bold;
            text-align: center;
        }

        .student-name,
        .date,
        .collaborators,
        .verified {
            font-size: 20px;
        }

        .assignment-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 20px;
            border: 2px solid black;
            padding: 10px;
            width: 60%;
            align-self: center;
            margin-left: auto;
            margin-right: auto;
        }

        .problem::after {
            content: "";
            display: block;
            height: 2px;
            background-color: #000;
            margin-top: 30px;
        }

        .header {
            display: flex;
            height: 100px;
            align-items: self-end;
            justify-content: space-between;
            width: 100%;
            padding-bottom: 10px;
            border-bottom: 1px solid #000;
            margin-bottom: 20px;
        }

        .header .header-title {
            font-size: 16px;
        }

        .header .header-img {
            height: inherit;
            width: auto;
        }

        .begin-problem {
            margin: 20px;
        }

        .problem-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            margin-left: 0px;
            margin-top: 40px;
        }

        .blueprint-requires-header,
        .blueprint-ensures-header,
        .step-header,
        .invariant-header {
            font-weight: bold;
            color: var(--blue);
            font-size: 20px;
        }

        .step-header {
            background-color: var(--purple);
        }

        .invariant-header {
            background-color: var(--green);
            font-size: 20px;
        }

        .section-header {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 10px;
            color: white;
            padding: 5px;
            border-radius: 5px;
            width: auto;
            padding-left: 10px;
        }

        .blueprint-header {
            background-color: var(--blue);
        }

        .operational-steps-header {
            background-color: var(--purple);
        }

        .ocaml-code-header {
            background-color: var(--orange);
        }

        .proof-header {
            background-color: var(--green);
        }

        .proof-sub-header {
            color: var(--green);
            padding-left: 0;
            font-weight: bold;
            font-size: 20px;
        }

        .blueprint {
            border-left: 5px solid var(--blue);
            padding-left: 10px;
        }

        .operational-steps {
            border-left: 5px solid var(--purple);
            padding-left: 10px;
        }

        .ocaml-code {
            border-left: 5px solid var(--orange);
            padding-left: 10px;
        }

        .proof {
            border-left: 5px solid var(--green);
            padding-left: 10px;
        }

        .section {
            margin: 20px 0 20px 0px;
            line-height: 30px;
        }

        .line-ref {
            color: var(--green);
            font-weight: bold;
            text-decoration: underline;
            font-style: italic;
        }

        .sub-section {
            margin-bottom: 15px;
        }

        .invariant {
            margin-bottom: 15px;
        }

        .code {
            background: black;
            color: inherit;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }

        .code pre {
            margin: 0;
            white-space: pre-wrap;
            background: transparent;
        }

        .code pre code {
            background: transparent;
        }

        .step {
            margin-bottom: 15px;
        }

        /* Prism.js styling compatibility */
        .line-numbers {
            position: relative;
            padding-left: 3.8em;
            counter-reset: linenumber;
        }

        .line-numbers>code {
            position: relative;
            white-space: inherit;
        }

        .line-numbers .line-numbers-rows {
            position: absolute;
            pointer-events: none;
            top: 0;
            font-size: 100%;
            left: -3.8em;
            width: 3em;
            letter-spacing: -1px;
            border-right: 1px solid #999;
            user-select: none;
        }

        .code-Verified {
            background-color: green;
            color: white;
            padding: 5px;
            border-radius: 5px;
            width: 200px;
            opacity: 0.5;
            margin-left: 10px;
            text-align: center;
            margin-bottom: 5px;
        }

        .code-Failed {
            background-color: red;
            color: white;
            padding: 5px;
            border-radius: 5px;
            width: 170px;
            opacity: 0.5;
            margin-left: 10px;
            text-align: center;
            margin-bottom: 5px;
        }

        .step-number {
            font-weight: bold;
            color: var(--purple);
            font-size: 20px;
        }
`;
    }

    generateHTML(): void {
        // This method concetantes the header html with the problems HTML only by calling the objects
        this.HTML = this.header.getHTML() + this.problems.map(problem => problem.getHTML()).join("");
    }

    getHTML(): string {
        // This method should be implemented to return the HTML representation of the Document
        this.generateHTML();
        return `<!DOCTYPE html>
                <html lang="en">

                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <link rel="stylesheet" href="boop.css">
                    <style>
                        ${this.generateCSS()}
                    </style>
                    <link href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/line-numbers/prism-line-numbers.min.css"
                        rel="stylesheet" />
                    <title>ICS Document</title>
                </head>

                <body><div class="document-content">${this.HTML}</div>
                        
                    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.js"></script>
                    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/line-numbers/prism-line-numbers.min.js"></script>
                    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-ocaml.min.js"></script>
                </body>

                </html>`;
    }
}

export class ICSCompiler {
    private outputPath: string;

    constructor() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            this.outputPath = this.resolveOutputPath(workspaceFolder.uri.fsPath);
        } else {
            this.outputPath = path.join(process.cwd(), 'output');
        }

        console.log("ICS Compiler initialized. Output path:", this.outputPath);
    }

    private getOutputPath(fileName: string): string {
        return this.resolveOutputPath(path.dirname(fileName));
    }

    private resolveOutputPath(baseDir: string): string {
        const config = vscode.workspace.getConfiguration('ics');
        const outputPath = config.get('outputPath', './output');

        return path.isAbsolute(outputPath)
            ? outputPath
            : path.resolve(baseDir, outputPath);
    }

    async compile(document: vscode.TextDocument) {
        try {

            // Parse the document
            const parsedDocument = this.parseDocument(document);

            // Generate HTML regardless of completeness for debugging
            const htmlContent = parsedDocument.getHTML();

            // Ensure output directory exists
            const outputPath = this.getOutputPath(document.fileName);
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(outputPath));

            const outputFileName = path.join(outputPath, `${path.basename(document.fileName, '.ics')}.html`);

            await vscode.workspace.fs.writeFile(vscode.Uri.file(outputFileName), Buffer.from(htmlContent, 'utf8'));

            vscode.window.showInformationMessage(`Compiled! Output: ${outputFileName}`);

            // Show warnings if incomplete
            if (!parsedDocument.isComplete) {
                vscode.window.showWarningMessage("Document compiled but may be incomplete.");
            }

        } catch (error) {
            console.error("Compilation error:", error);
            vscode.window.showErrorMessage(`Compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private parseDocument(document: vscode.TextDocument): Document {
        console.log("Document parsing started.");
        const doc = new Document();
        const lines = document.getText().split('\n');
        const headerOpenRegex = /<<\s*header\s*/i;
        const headerCloseRegex = /^\s*header\s*>>$/i;
        const problemOpenRegex = /<<\s*problem\s+([^:]+)\s*:\s*(.*)/i;
        const problemCloseRegex = /^\s*problem\s*>>$/i;
        const len = lines.length;


        /**
         * Summary of how the function works:
         * 1. It reads the document line by line.
         * 2. It checks for the opening header tag `<< header:`.
         * 3. If the header is not complete, it collects lines until it finds the closing tag `header>>`.
         * 4. It extracts lines till the closing tag, sends these to the header object, which parses the header information and populates the `Header` object.
         * 5. It then looks for the opening problem tag `<< problem:`.
         * 6. If it finds a problem tag, it extracts the problem number and title.
         * 7. It collects lines until it finds the closing tag `problem>>`.
         * 8. It creates a new `Problem` object, populates it with the problem information, and adds it to the document's problems array.
         * 9. It can repeat the process multiple times for multiple problems.
         * 10. Finally, it returns the populated `Document` object.
         * 11. Error messages are currently shown using vs code windows.
         */
        for (let i = 0; i < len; i++) {
            const currentLine = lines[i];
            // See if header is done, if not, see if it matches
            if (!doc.header.isComplete && headerOpenRegex.test(currentLine)) {
                //Find the next line that contains the closing header tag header>>
                const headerInfo: string[] = [];
                let headerClosed = false;
                for (let j = i + 1; j < len; j++) {
                    if (headerCloseRegex.test(lines[j])) {
                        headerClosed = true;
                        break;
                    }
                    headerInfo.push(lines[j]);
                }
                if (headerClosed) {
                    doc.header.parse(headerInfo);
                    doc.assignmentNumber = doc.header.assignmentNo;
                    console.log("Doc assignment No", doc.assignmentNumber);
                    doc.addAssignmentCriteria();
                } else {
                    vscode.window.showErrorMessage("Header section is not closed properly.");
                }
            }

            if (problemOpenRegex.test(currentLine)) {
                // Extract problem number and title
                const problemInfo = currentLine.match(problemOpenRegex);
                if (problemInfo && problemInfo.length >= 2) {

                    // Create a new Problem object
                    const problemNumber = problemInfo[1];
                    const problemTitle = problemInfo[2].trim();
                    const problem = new Problem();
                    problem.accept(problemTitle, problemNumber);

                    // Find the next lines until we hit the closing tag
                    const problemLines: string[] = [];
                    let problemClosed = false;
                    for (let j = i + 1; j < len; j++) {
                        if (problemCloseRegex.test(lines[j])) {
                            problemClosed = true;
                            break;
                        }
                        problemLines.push(lines[j]);
                    }

                    if (problemClosed) {
                        problem.parse(problemLines);
                        // Add the problem object to the document object
                        doc.addProblem(problem);
                    } else {
                        vscode.window.showErrorMessage("Problem section is not closed properly.");
                    }
                } else {
                    vscode.window.showErrorMessage("Problem section is not formatted correctly.");
                }
            }
        }
        return doc;
    }

    private getHTML(document: Document): string {
        // This method generates the HTML representation of the document
        return document.getHTML();
    }
}

/**
 * IMPROVEMENTS:
 * 1. A general parseSection function
 * 5. Don't raise vs code window errors for everything
 * 11. Make a generate JSON interface for instructors 
 * 12. Connect with validator.ts to use isComplete to validate 
 * 14. Currently the code checks if a wrong section is in a problem that bans it, but does not check if all required sections are there
 */