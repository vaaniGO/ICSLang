"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Document = exports.Problem = exports.Proof = exports.OperationalSteps = exports.OcamlCode = exports.Blueprint = exports.Header = exports.ICSCompiler = void 0;
// Basically an array of dictionaries 
// Each dictionary corresponds to one problem
let assignment_info = [];
let isDefault = true;
// These are automatically populated to keep track of allowed features in the current assignment and code. 
// These two are the only global variables needed.
const fs = __importStar(require("fs"));
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const util_1 = require("util");
/**
 * Throughout the code, newline handling must be done using \n. The escapeHtml function converts this to <br>. Do not use <br> directly anywhere.
 * All injected text must be escaped first. This prevents injection attacks.
 */
function escapeHtml(unsafe) {
    // First, temporarily replace <tex> and </tex> with placeholders
    const texOpenPlaceholder = "___TEX_OPEN_PLACEHOLDER___";
    const texClosePlaceholder = "___TEX_CLOSE_PLACEHOLDER___";
    let result = unsafe
        .replace(/<tex>/g, texOpenPlaceholder)
        .replace(/<\/tex>/g, texClosePlaceholder);
    // Then escape all HTML characters
    result = result
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\n/g, "<br>");
    // Finally, restore the <tex> and </tex> tags
    result = result
        .replace(new RegExp(texOpenPlaceholder, 'g'), "<tex>")
        .replace(new RegExp(texClosePlaceholder, 'g'), "</tex>");
    return result;
}
class Header {
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
    checkValidAssignmentNo() {
        // Since both compiler.ts and assignment_1.json are in ICSLang/src,
        // construct path relative to the current file location
        const assignmentFile = path.join(__dirname, `../src/assignment_${this.assignmentNo}.json`);
        if (!fs.existsSync(assignmentFile)) {
            // vscode.window.showErrorMessage(`Assignment file not found at: ${assignmentFile}, trying to use a default compilation.`);
            return false || isDefault;
        }
        return true;
    }
    parse(lines) {
        // DON'T reset subsections - just reset values
        Object.keys(this.subsections).forEach(key => {
            this.subsections[key] = "";
        });
        let count = 0;
        const requiredKeys = ["Name", "Assignment", "Collaborators", "Date", "Professor"];
        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1)
                continue;
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
        // Check if all required fields are filled
        this.isComplete = count === 5;
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
            }
            else {
                vscode.window.showErrorMessage("Could not extract assignment number from Assignment field.");
                this.isComplete = false;
                return;
            }
        }
        if (!this.isComplete) {
            const missingFields = requiredKeys.filter(key => this.subsections[key] === "");
            vscode.window.showErrorMessage(`Header incomplete. Missing fields: ${missingFields.join(', ')}`);
        }
        console.log("Final isComplete", this.isComplete);
    }
    accept() { }
    getHTML() {
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
            <div class="collaborators">Collaborators: ${escapeHtml(Collaborators)}</div>
        </div>`;
    }
}
exports.Header = Header;
//  The below 3 classes are subsections of the Blueprint class. They are only called by blueprint if they are valid in the problem under consideration.
// This is why they have no validity checks within themselves. Since blueprint is already looping once either ways, we don't want to loop extra inside these classes.
/**
     * Expected format:
     * <<functional-correctness
     * Requires: <requires clause>
     * Ensures: <ensures clause>
     * functional-correctness>>
 */
class FunctionalCorrectness {
    constructor() {
        this.subsections = ["", "", ""];
        this.name = "Functional Correctness";
        this.isComplete = false;
        this.problemNo = "";
    }
    accept(problemNo) {
        this.problemNo = problemNo.trim();
        // if (!this.isAllowedInProblem()) {
        //     vscode.window.showErrorMessage("Functional Correctness section is not allowed in this problem.");
        //     return;
        // }
    }
    parse(lines) {
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
                this.subsections[counter] += currentLine.split(':')[1];
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
    getHTML() {
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
class Complexity {
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
    accept(problemNo) {
        this.problemNo = problemNo.trim();
    }
    // Parses the content of the Complexity section and updates the object fields accordingly
    parse(lines) {
        let len = lines.length;
        let currentSection = "";
        const timeRegex = /time\s*:/i;
        const spaceRegex = /space\s*:/i;
        for (let i = 0; i < len; i++) {
            const currentLine = lines[i];
            if (timeRegex.test(currentLine)) {
                currentSection = "Time";
                this.subsections['Time'] += currentLine.split(':')[1];
            }
            else if (spaceRegex.test(currentLine)) {
                currentSection = "Space";
                this.subsections['Space'] += currentLine.split(':')[1];
            }
            else if (currentSection != "") {
                this.subsections[currentSection] += currentLine;
            }
        }
        // Only time complexity is required, the other is optional
        this.isComplete = this.subsections['Time'] != "" ? true : false;
        if (!this.isComplete) {
            vscode.window.showErrorMessage(`Complexity section is incomplete for problem number ${this.problemNo}. Please fill the Time Complexity clause.`);
            return;
        }
    }
    getHTML() {
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
class InputOutput {
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
    parse(lines) {
        const len = lines.length;
        let currentSection = "";
        // We want to ensure that for all 0<i<len, Input[i] and Output[i] are paired, naturally, len(Input) = len(Output)
        for (let i = 0; i < len; i++) {
            let currentLine = lines[i];
            if (currentLine.toLowerCase().includes("input")) {
                // Require that an input must be followed by an output and no duplication.
                if (currentSection == "Input") {
                    vscode.window.showErrorMessage("Input section is violating order.");
                    return;
                }
                currentLine = currentLine.substring(currentLine.indexOf(':') + 1).trim(); // Remove the "Input:" part
                currentSection = "Input";
            }
            else if (currentLine.toLowerCase().includes("output")) {
                // Means either duplicate or it is the first section
                if (currentSection == "Output" || currentSection == "") {
                    vscode.window.showErrorMessage("Output section is violating order.");
                    return;
                }
                currentSection = "Output";
                currentLine = currentLine.substring(currentLine.indexOf(':') + 1).trim(); // Remove the "Output:" part
            }
            if (currentSection) {
                console.log("Current line:", currentLine);
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
    accept(problemNo) {
        this.problemNo = problemNo.trim();
        // Check if the Input-Output section is allowed in the current problem
        // if (!this.isAllowedInProblem()) {
        //     vscode.window.showErrorMessage("Input-Output section is not allowed in this problem.");
        //     return;
        // }
    }
    generate_InputOutput_HTML() {
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
    getHTML() {
        // This method should be implemented to return the HTML representation of the Input-Output section
        return `<div class="blueprint-input-output sub-section">
                    ${this.generate_InputOutput_HTML()}
                </div>`;
    }
}
class Blueprint {
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
        this.allowed = ["FunctionalCorrectness", "Input-Output", "Complexity"]; // Let this be the default value
    }
    // This method checks if the Blueprint section is allowed in the current problem
    // It is used to validate the section against the assignment_info data
    // It also populates allowed[] so that we can see allowed and not allowed subsections while parsing 
    // We ensure this is called before parse() so that we can check if the subsections are allowed or not
    isAllowedInProblem() {
        if (isDefault) {
            return true;
        }
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
    accept(problemNo) {
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
    parse(lines) {
        if (!this.allowed) {
            vscode.window.showErrorMessage("Blueprint object not initialised properly!");
            return;
        }
        let len = lines.length;
        const fcOpenRegex = /<<\s*functional-correctness\s*/i;
        const InputOutputOpenRegex = /<<\s*input-output\s*/i;
        const complexityOpenRegex = /<<\s*complexity\s*/i;
        const fcCoseRegex = /^\s*functional-correctness\s*>>$/i;
        const InputOutputCloseRegex = /^\s*input-output\s*>>\s*$/i;
        const complexityCloseRegex = /^\s*complexity\s*>>$/i;
        for (let i = 0; i < len; i++) {
            let currentLine = lines[i];
            let currentLineLower = currentLine.toLowerCase();
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
                }
                else {
                    console.log("Input content: ", InputOutput_content);
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
                }
                else {
                    vscode.window.showErrorMessage("Complexity section is not closed properly.");
                    return;
                }
            }
        }
        this.checkRequirements();
    }
    // Check if any required section is missing. The check for whether blueprint itself is allowed is handled separetely in accept(). Called by parse()
    checkRequirements() {
        if (isDefault) {
            this.isComplete = true;
            return;
        }
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
    getHTML() {
        // This method should be implemented to return the HTML representation of the Blueprint section
        // No need to escape HTML here as this.HTML contains purely the other classes' generated HTML which are already escaped
        return `<div class="section"> <div class="blueprint">
        <div class="section-header blueprint-header">BLUEPRINT</div>
        ${this.HTML}
                </div>
                </div>`;
    }
}
exports.Blueprint = Blueprint;
class OperationalSteps {
    constructor() {
        this.subsections = {
            Steps: []
        };
        this.name = "Operational Steps";
        this.isComplete = false;
        this.problemNo = "";
    }
    isAllowedInProblem() {
        if (isDefault) {
            return true;
        }
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
    parse(lines) {
        const stepMatchRegex = /^\s*step\s*\d*\s*:\s*(.*)$/i;
        let len = lines.length;
        this.isComplete = len > 0;
        let currentStep = -1;
        for (let i = 0; i < len; i++) {
            let currentLine = lines[i];
            // Every line is either the opening of a new step, or a continuation of the previous step
            if (stepMatchRegex.test(currentLine)) {
                currentStep++;
                currentLine = currentLine.split(":")[1]; // In the lines containing a step opening extract rest of the line
                this.subsections.Steps[currentStep] = currentLine;
            }
            else
                this.subsections.Steps[currentStep] += "\n" + currentLine; // Else append the original line
        }
    }
    // This method is not used currently because ops does not have any attributes like title, no.
    accept(problemNo) {
        this.problemNo = problemNo.trim();
        if (!this.isAllowedInProblem()) {
            vscode.window.showErrorMessage(`Operational Steps section is not allowed for problem ${this.problemNo}.`);
            return;
        }
    }
    // This method generates HTML for a single step, with the step number
    getStepHTML(step, index) {
        return `<div class="step" id="step-${index}" >
                    <span class="step-number">Step ${index + 1}:</span>
                    <span class="step-content">${escapeHtml(step)}</span>
                </div>`;
    }
    getHTML() {
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
exports.OperationalSteps = OperationalSteps;
class OcamlCode {
    constructor(context) {
        this.subsections = {
            Code: "",
            Status: ""
        };
        this.name = "Code";
        this.isComplete = false;
        this.problemNo = "";
        this.context = context;
        this.allowed_flags = "-allow_for_loops -allow_while_loops -allow_mutability -allow_lambdas";
    }
    isAllowedInProblem() {
        if (isDefault) {
            return true;
        }
        // Check if the Code section is allowed in the current problem
        for (const info of assignment_info) {
            if (info.Number === this.problemNo) {
                return "Ocaml Code" in info;
            }
        }
        return false;
    }
    // Unused and empty function because the code field does not have any attributes like title, no. 
    accept(problemNo) {
        this.problemNo = problemNo.trim();
        if (!this.isAllowedInProblem()) {
            vscode.window.showErrorMessage(`Code section is not allowed for problem ${this.problemNo}.`);
            return;
        }
    }
    // Sets the code content for the object and sends it to verify which verifies it and sets the status accordingly.
    async parse(codeLines, allowed_flags = "") {
        this.subsections.Code = codeLines.join("\n");
        // If the code is not empty, then the section is complete
        this.isComplete = this.subsections.Code.length > 0;
        this.allowed_flags = allowed_flags.trim();
        await this.ocamlVerify(this.context);
    }
    // Updates the 'status' subsection appropriately based on the status of the code.
    // Assumes that the code content has already been populated
    async ocamlVerify(context) {
        const ppxDir = path.resolve(__dirname, '../../ICSLang/ppx_1');
        const tempDir = ppxDir;
        if (!fs.existsSync(tempDir))
            fs.mkdirSync(tempDir, { recursive: true });
        const tempFile = path.join(ppxDir, `section_${(0, crypto_1.randomBytes)(8).toString('hex')}.ml`);
        fs.writeFileSync(tempFile, this.subsections.Code, 'utf8');
        try {
            console.log("Ocaml verification begun!");
            const execAsync = (0, util_1.promisify)(child_process_1.exec);
            const execFileAsync = (0, util_1.promisify)(require('child_process').execFile);
            // Build the command with proper shell handling
            let checkerBinary = "checker.exe";
            // resolve against extension's install path
            const checkerPath = path.join(context.extensionPath, "/ppx_1/_build/default/bin/", checkerBinary);
            const result = await execFileAsync(checkerPath, [tempFile, ...this.allowed_flags]);
            console.log("Ocaml verification result:", result.stdout);
            this.subsections.Status = "ICS Verified";
        }
        catch (err) {
            console.log("Ocaml verification error:", err.message);
            console.log("Stderr:", err.stderr);
            console.log("Stdout:", err.stdout);
            this.subsections.Status = "ICS Failed";
            vscode.window.showErrorMessage(`🐫 OOPSCaml! ERROR: ${err.stderr || err.message}`);
        }
        finally {
            // Delete the temporary file
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
    }
    getHTML() {
        let code_status = "";
        if (this.subsections.Status === "ICS Verified") {
            code_status = "code-Verified";
        }
        else
            code_status = "code-Failed";
        console.log(this.subsections.Code);
        return `<div class="section">
            <div class="ocaml-code-header section-header">OCAML CODE
            <span class="code-status ${code_status}">${this.subsections.Status}</span></div>
            <div class="ocaml-code">
                <div class="code sub-section">
                    <pre class="line-numbers"><code class="language-ocaml">${this.subsections.Code}</code></pre>
                </div>
            </div> 
        </div>`;
    }
}
exports.OcamlCode = OcamlCode;
class Induction {
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
    parse(lines) {
        // This method parses the content of the Induction section
        const len = lines.length;
        const baseCaseRegex = /^\s*base\s*case\s*:\s*(.*)$/i;
        const inductiveHypothesisRegex = /^\s*inductive\s*hypothesis\s*:\s*(.*)$/i;
        const inductiveStepRegex = /^\s*inductive\s*step\s*:\s*(.*)$/i;
        let prevKey = "";
        for (let i = 0; i < len; i++) {
            const currentLine = lines[i];
            if (baseCaseRegex.test(currentLine)) {
                this.subsections.BaseCase = currentLine.split(':')[1];
                // Ensure that Base Case comes first
                if (prevKey !== "") {
                    vscode.window.showErrorMessage("Base Case must come first.");
                    return;
                }
                prevKey = "BaseCase"; // Keep track of the last key to ensure order
            }
            else if (inductiveHypothesisRegex.test(currentLine)) {
                this.subsections.InductiveHypothesis = currentLine.split(':')[1];
                // Ensure that Inductive Hypothesis comes after Base Case
                if (prevKey !== "BaseCase") {
                    vscode.window.showErrorMessage("Inductive Hypothesis must come after Base Case.");
                    return;
                }
                prevKey = "InductiveHypothesis";
            }
            else if (inductiveStepRegex.test(currentLine)) {
                this.subsections.InductiveStep = currentLine.split(':')[1];
                // Ensure that Inductive Step comes after Inductive Hypothesis
                if (prevKey !== "InductiveHypothesis") {
                    vscode.window.showErrorMessage("Inductive Step must come after Inductive Hypothesis.");
                    return;
                }
                prevKey = "InductiveStep";
            }
            else if (currentLine.trim() != "") {
                this.subsections[prevKey] += currentLine + "\n"; // Append the current line to the last key
            }
        }
        //remove the \n character from the first line in every subsection
        Object.keys(this.subsections).forEach(key => {
            this.subsections[key] = this.subsections[key].replace(/^\n/, '').trim();
        });
        // If all subsections are filled, then the induction section is complete
        this.isComplete = [this.subsections.BaseCase, this.subsections.InductiveHypothesis, this.subsections.InductiveStep]
            .every(s => s.trim().length > 0);
        if (!this.isComplete) {
            vscode.window.showErrorMessage("Induction section is incomplete.");
            return;
        }
    }
    // The below function is not currently used.
    accept() { }
    getHTML() {
        // This method should be implemented to return the HTML representation of the Induction section
        return `
                <div class="invariant-header section-header">INDUCTION</div>
                <div class="induction">
                    <div class="base-case sub-section">
                        <span class="proof-sub-header">Base Case: </span>
                        <div class="tab-content">
                        ${escapeHtml(this.subsections.BaseCase)}
                        </div>
                    </div>
                    <div class="inductive-hypothesis sub-section">
                        <span class="proof-sub-header">Inductive Hypothesis: </span> 
                        <div class="tab-content">
                        ${escapeHtml(this.subsections.InductiveHypothesis)}
                        </div>
                    </div>
                    <div class="inductive-step sub-section">
                        <span class="proof-sub-header">Inductive Step: </span> 
                        <div class="tab-content">
                        ${escapeHtml(this.subsections.InductiveStep)}
                        </div>
                    </div>
                </div>
            `;
    }
}
class Invariant {
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
    parse(lines) {
        // This method parses the content of the Invariant section
        const len = lines.length;
        const initialisationRegex = /^\s*initialisation\s*:\s*(.*)$/i;
        const maintenanceRegex = /^\s*maintenance\s*:\s*(.*)$/i;
        const terminationRegex = /^\s*termination\s*:\s*(.*)$/i;
        let prevKey = "";
        for (let i = 0; i < len; i++) {
            const currentLine = lines[i];
            if (initialisationRegex.test(currentLine)) {
                this.subsections.Initialisation = currentLine.split(':')[1];
                // Ensure that Initialisation comes first
                if (prevKey !== "") {
                    vscode.window.showErrorMessage("Initialisation must come first.");
                    return;
                }
                prevKey = "Initialisation"; // Keep track of the last key to ensure order
            }
            else if (maintenanceRegex.test(currentLine)) {
                this.subsections.Maintenance = currentLine.split(':')[1];
                // Ensure that Maintenance comes after Initialisation
                if (prevKey !== "Initialisation") {
                    vscode.window.showErrorMessage("Maintenance must come after Initialisation.");
                    return;
                }
                prevKey = "Maintenance";
            }
            else if (terminationRegex.test(currentLine)) {
                this.subsections.Termination = currentLine.split(':')[1];
                // Ensure that Termination comes after Maintenance
                if (prevKey !== "Maintenance") {
                    vscode.window.showErrorMessage("Termination must come after Maintenance.");
                    return;
                }
                prevKey = "Termination";
            }
            else {
                this.subsections[prevKey] += "\n" + "&nbsp" + currentLine; // Append the current line to the last key
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
    accept() { }
    getHTML() {
        // This method should be implemented to return the HTML representation of the Invariant section
        return `
                <div class="invariant-header section-header">INVARIANT</div>
                <div class="invariant">
                    <div class="invariant initialisation sub-section">
                        <span class="proof-sub-header">Invariant Statement: </span> 
                        <div class="tab-content">
                        ${escapeHtml(this.subsections.Initialisation)}
                        </div>
                    </div>
                    <div class="invariant maintenance sub-section">
                        <span class="proof-sub-header">Maintenance: </span> 
                        <div class="tab-content">
                        ${escapeHtml(this.subsections.Maintenance)}
                        </div>
                    </div>
                    <div class="invariant termination sub-section">
                        <span class="proof-sub-header">Termination: </span> 
                        <div class="tab-content">
                        ${escapeHtml(this.subsections.Termination)}
                        </div>
                    </div>
                </div>
            `;
    }
}
// Includes support for a helper proof, proof with title, proof with induction, proof with loop invariant
class Proof {
    constructor() {
        this.isHelper = false;
        this.title = "";
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
    isAllowedInProblem() {
        if (isDefault) {
            return true;
        }
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
    accept(isHelper, title, problemNo) {
        this.isHelper = isHelper;
        this.title = title;
        this.problemNo = problemNo.trim();
        if (!this.isAllowedInProblem()) {
            vscode.window.showErrorMessage(`Proof section is not allowed for problem ${this.problemNo}.`);
            return;
        }
    }
    parse(lines) {
        const inductionOpenRegex = /<<\s*induction\s*/i;
        const inductionCloseRegex = /^\s*induction\s*>>$/i;
        const invariantOpenRegex = /<<\s*invariant\s*/i;
        const invariantCloseRegex = /^\s*invariant\s*>>$/i;
        const len = lines.length;
        for (let i = 0; i < len; i++) {
            const currentLine = lines[i];
            // Parse the content of each subsection based on the line
            //Multiple proof sections are allowed
            if (inductionOpenRegex.test(currentLine)) {
                if (this.subsections.Induction.isComplete) {
                    this.subsections.Induction = new Induction(); // Reset induction for multiple inductions
                }
                //Iterate to find the closing tag
                const inductionContent = [];
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
                    this.HTML += this.subsections.Induction.getHTML() + "\n";
                    i = j;
                }
                else {
                    vscode.window.showErrorMessage("Induction section is not closed properly.");
                }
            }
            else if (invariantOpenRegex.test(currentLine)) {
                //Iterate to find the closing tag
                const invariantContent = [];
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
                }
                else {
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
    getHTML() {
        let subsectionHTML = "";
        if (this.subsections.Induction.isComplete) {
            subsectionHTML = this.subsections.Induction.getHTML();
        }
        else if (this.subsections.Invariant.isComplete) {
            subsectionHTML = this.subsections.Invariant.getHTML();
        }
        else {
            return "";
        }
        return `<div class="section">
        <div class="proof-header section-header">PROOF</div>
        <div class="proof">
            <div class="proof-content sub-section">
                ${this.HTML}
            </div>
        </div>
    </div>`;
    }
}
exports.Proof = Proof;
class TextAnswer {
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
    isAllowedInProblem() {
        if (isDefault) {
            return true;
        }
        // Check if the Text Answer section is allowed in the current problem
        for (const info of assignment_info) {
            if (info.Number === this.problemNo) {
                return "Text Answer" in info;
            }
        }
        return false;
    }
    // Accepts the title and updates the object fields accordingly
    accept(title, problemNo) {
        this.title = title.trim();
        this.problemNo = problemNo.trim();
        if (!this.isAllowedInProblem()) {
            vscode.window.showErrorMessage(`Text Answer section is not allowed for problem ${this.problemNo}.`);
            return;
        }
    }
    parse(lines) {
        if (this.title.length == 0) {
            vscode.window.showErrorMessage("Text Answer section must have a title.");
            return;
        }
        // This method parses the content of the Text Answer section
        this.subsections.Answer = lines.join("\n");
        // If the answer is not empty, then the section is complete
        this.isComplete = this.subsections.Answer.length > 0;
    }
    getHTML() {
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
class Problem {
    constructor(context) {
        this.context = context;
        this.subsections = {
            Blueprint: new Blueprint(),
            OperationalSteps: new OperationalSteps(),
            Code: new OcamlCode(this.context),
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
        // Check if the problem number is valid
        if (!this.problemNo || this.problemNo.trim().length === 0) {
            vscode.window.showErrorMessage("Problem number is not set or is empty.");
            return false;
        }
        if (isDefault) {
            return true;
        }
        // Check if the problem number exists in the assignment_info
        const problemInfo = assignment_info.find(info => info.Number === this.problemNo);
        if (!problemInfo) {
            vscode.window.showErrorMessage(`Problem number ${this.problemNo} does not exist in the assignment info. Make sure to use the exact problem number only.`);
            return false;
        }
        return true;
    }
    get_allowed_flags() {
        // Get the allowed flags for the current problem from assignment_info
        const problemInfo = assignment_info.find(info => info.Number === this.problemNo);
        if (problemInfo && problemInfo["Ocaml Code"] != null && Array.isArray(problemInfo["Ocaml Code"])) {
            return problemInfo["Ocaml Code"].join(" ");
        }
        return "";
    }
    // This method parses the content of the Problem section, updates the objects of its subsections and the boolean to indicate whether the problem is complete
    async parse(lines) {
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
                const blueprintContent = [];
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
                }
                else {
                    vscode.window.showErrorMessage("Blueprint section is not closed properly.");
                }
            }
            // Operational Steps only appears once in every problem
            else if (operationalStepsOpenRegex.test(currentLine)) {
                if (this.subsections.OperationalSteps.isComplete) {
                    vscode.window.showErrorMessage("Operational Steps section allowed only once");
                    return;
                }
                const operationalStepsContent = [];
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
                }
                else {
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
                const codeContent = [];
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
                    //get allowed_flags from assignment_info
                    const allowed_flags = this.get_allowed_flags();
                    await code.parse(codeContent);
                    // Since we aren't keeping track of multiple code objects, we collate the HTML as we go
                    this.HTML += code.getHTML() + "\n";
                    i = j;
                }
                else {
                    vscode.window.showErrorMessage("OCaml Code section is not closed properly.");
                }
            }
            // Multiple proofs can be written in one problem
            else if (proofOpenRegex.test(currentLine)) {
                //Iterate to find the closing tag
                const proofContent = [];
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
                }
                else {
                    vscode.window.showErrorMessage("Proof section is not closed properly.");
                }
            }
            else if (TextAnswerOpenRegex.test(currentLine)) {
                //Iterate to find the closing tag
                const TextAnswerContent = [];
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
                }
                else {
                    vscode.window.showErrorMessage("Text Answer section is not closed properly.");
                }
            }
        }
        this.isComplete = true;
    }
    accept(title, problemNo) {
        this.title = title.trim();
        this.problemNo = problemNo.trim();
        this.checkValidProblemNo();
    }
    getHTML() {
        // This method should be implemented to return the HTML representation of the Problem section
        return `<div class="problem">
                    <div class="problem-title">${this.problemNo}: ${this.title}</div>
                    ${this.HTML}
                </div>`;
    }
}
exports.Problem = Problem;
class Document {
    constructor() {
        this.header = new Header();
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
    addProblem(problem) {
        this.problems.push(problem);
        this.isComplete = this.isComplete && problem.isComplete;
    }
    // Parse the JSON, make a structured dictionary with assignment info
    addAssignmentCriteria() {
        const customFile = path.join(__dirname, `../../ICSLang/src/assignment_${this.assignmentNumber}.json`);
        if (!fs.existsSync(customFile)) {
            return;
        }
        const rawData = JSON.parse(fs.readFileSync(customFile, 'utf8'));
        // Iterate over each problem in the Problems array
        for (const problem of rawData.Problems) {
            // Create a new dictionary for this problem
            const problemDict = {};
            // Iterate over all properties of the current problem
            for (const [key, value] of Object.entries(problem)) {
                problemDict[key] = value;
            }
            // Add the problem dictionary to assignment_info
            assignment_info.push(problemDict);
            isDefault = false;
        }
    }
    generateCSS() {
        return `  
        :root {
            --blue: #3674B5;
            --purple: #7F55B1;
            --orange: #ef7f08;
            --green: #096B68;
            --gray: #999;
        }

        * {
            font-family: cm ss10, sans-serif;
        }

        body {
            display: flex;
            flex-direction: column;
            font-weight: 550;
            margin: 30px;
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

        .step-number {
            font-weight: bold; 
            font-size: 20px;
            color: var(--purple);
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


        .text-answer-header {
            background-color: var(--gray);
        }

        .text-answer {
            border-left: 5px solid var(--gray);
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


        pre[class*=language-] {
            border-radius: 0;
            border: none;
        }

        .code-Verified {
            background-color: green;
            color: white;
            padding: 5px;
            border-radius: 5px;
            width: 200px;
            text-align: center;
            margin-bottom: 5px;
            margin-left: 10px;
        }

        .code-Failed {
            background-color: red;
            color: white;
            padding: 5px;
            border-radius: 5px;
            width: 170px;
            text-align: center;
            margin-bottom: 5px;
            margin-left: 10px;
        }

        .tab-content {
            margin-left: 20px;
        }
`;
    }
    generateHTML() {
        // This method concetantes the header html with the problems HTML only by calling the objects
        this.HTML = this.header.getHTML() + this.problems.map(problem => problem.getHTML()).join("");
    }
    getHTML() {
        // This method should be implemented to return the HTML representation of the Document
        this.generateHTML();
        console.log("Reached here!");
        return `<!DOCTYPE html>
                <html lang="en">

                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <link rel="stylesheet" href="boop.css">
                    <title>ICS Document</title>


                    <script>
                            MathJax = {
                                tex: {
                                    inlineMath: [['$', '$'], ['\(', '\)']], // Inline math delimiters
                                    displayMath: [['$$', '$$'], ['\[', '\]']], // Display math delimiters
                                    processEscapes: true
                                },
                                svg: {
                                    fontCache: 'global'
                                },
                                options: {
                                    processHtmlClass: 'tex-enabled',
                                    ignoreHtmlClass: '.*',
                                    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
                                }
                            };

                            // Custom function to process tex tags after page load
                            window.addEventListener('DOMContentLoaded', function () {
                                // Find all <tex> elements and add the tex-enabled class
                                const texElements = document.querySelectorAll('tex');
                                texElements.forEach(element => {
                                    element.classList.add('tex-enabled');
                                }); 

                                // Trigger MathJax to reprocess
                                if (window.MathJax && window.MathJax.typesetPromise) {
                                    MathJax.typesetPromise();
                                }
                            });
                        </script>
                  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" defer></script>


           
                <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-twilight.min.css" rel="stylesheet" />

                <!-- Line numbers plugin CSS -->
                <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/line-numbers/prism-line-numbers.min.css"
                    rel="stylesheet" />

                                       <style>
                        ${this.generateCSS()}
                    </style>
                    
                </head>

                <body><div class="document-content">${this.HTML}</div>
                    <!-- CORRECTED PRISM.JS JAVASCRIPT CDN LINKS -->
                    <!-- Main Prism.js core -->
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>

                    <!-- OCaml language component - CORRECTED VERSION -->
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-ocaml.min.js"></script>

                    <!-- Line numbers plugin -->
                    <script
                        src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/line-numbers/prism-line-numbers.min.js"></script>

                            
                </body>

                </html>`;
    }
}
exports.Document = Document;
class ICSCompiler {
    constructor(context) {
        this.context = context;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            this.outputPath = this.resolveOutputPath(workspaceFolder.uri.fsPath);
        }
        else {
            this.outputPath = path.join(process.cwd(), 'output');
        }
        console.log("ICS Compiler initialized. Output path:", this.outputPath);
    }
    resolveOutputPath(baseDir) {
        const config = vscode.workspace.getConfiguration('ics');
        const outputPath = config.get('outputPath', './output');
        return path.isAbsolute(outputPath)
            ? outputPath
            : path.resolve(baseDir, outputPath);
    }
    async compile(document) {
        console.log("=== COMPILATION STARTED ===");
        console.log("Document filename:", document.fileName);
        try {
            // Step 1: Parse the document
            console.log("Step 1: Parsing document...");
            const parsedDocument = await this.parseDocument(document, this.context);
            console.log("✓ Document parsed");
            // Step 2: Generate HTML
            console.log("Step 2: Generating HTML...");
            const htmlContent = parsedDocument.getHTML();
            console.log("✓ HTML generated, length:", htmlContent.length);
            // Step 3: Determine output path
            console.log("Step 3: Determining output path...");
            const documentDir = path.dirname(document.fileName);
            const outputDir = path.join(documentDir, 'output'); // Simple fallback
            console.log("Output directory:", outputDir);
            // Step 4: Create output directory
            console.log("Step 4: Creating output directory...");
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
                console.log("✓ Directory created");
            }
            else {
                console.log("✓ Directory already exists");
            }
            // Step 5: Write file
            console.log("Step 5: Writing HTML file...");
            const baseName = path.basename(document.fileName, '.ics');
            const outputFileName = path.join(outputDir, `${baseName}.html`);
            fs.writeFileSync(outputFileName, htmlContent, 'utf8');
            console.log("✓ File written to:", outputFileName);
            // Step 6: Show success message
            console.log("Step 6: Showing success message...");
            await vscode.window.showInformationMessage(`✅ Compiled! Output: ${outputFileName}`);
            console.log("✓ Success message displayed");
            // Show warnings if incomplete
            if (!parsedDocument.isComplete) {
                await vscode.window.showWarningMessage("⚠️ Document compiled but may be incomplete.");
            }
            console.log("=== COMPILATION COMPLETED SUCCESSFULLY ===");
        }
        catch (error) {
            console.error("=== COMPILATION FAILED ===");
            console.error("Error details:", error);
            console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack trace');
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await vscode.window.showErrorMessage(`❌ Compilation failed: ${errorMessage}`);
        }
    }
    async parseDocument(document, context) {
        console.log("Document parsing started.");
        const doc = new Document();
        // await initialise_dune();
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
                const headerInfo = [];
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
                }
                else {
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
                    const problem = new Problem(context);
                    problem.accept(problemTitle, problemNumber);
                    // Find the next lines until we hit the closing tag
                    const problemLines = [];
                    let problemClosed = false;
                    for (let j = i + 1; j < len; j++) {
                        if (problemCloseRegex.test(lines[j])) {
                            problemClosed = true;
                            break;
                        }
                        problemLines.push(lines[j]);
                    }
                    if (problemClosed) {
                        await problem.parse(problemLines);
                        // Add the problem object to the document object
                        doc.addProblem(problem);
                    }
                    else {
                        vscode.window.showErrorMessage("Problem section is not closed properly.");
                    }
                }
                else {
                    vscode.window.showErrorMessage("Problem section is not formatted correctly.");
                }
            }
        }
        return doc;
    }
    getHTML(document) {
        // This method generates the HTML representation of the document
        return document.getHTML();
    }
}
exports.ICSCompiler = ICSCompiler;
//# sourceMappingURL=compiler.js.map