const allowed_flags = "";
const assignment_info = "";
// These are automatically populated to keep track of allowed features in the current assignment and code. 
// This must be the very first line. Do not remove it. 

import * as fs from 'fs';
import { execSync } from 'child_process';
import * as vscode from 'vscode';
import * as path from 'path';
import { type } from 'os';

// Here we are working with data, not behaviour so we use an interface, not a class
// We export it so that we can use it in other files and modules
// This is like a 'contract' that every object of this type has to follow\
// Do not change the interface

export interface Section {
    subsections: { [key: string]: string | string[] | Section }; // improves type safety
    name: string;
    isComplete: boolean;
    getHTML(): string;
    parse(lines: string[]): void;
    accept(...args: any[]): void;
}

class Header implements Section {
    subsections: { [key: string]: string };
    name: string;
    isComplete: boolean;

    // below is the default constructor to only initialise keys
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
    }

    // Expects an array of lines already pertaining to the header only
    parse(
        lines: string[]
    ): void {
        for (const line of lines) {
            const [key, value] = line.split(':').map(part => part.trim());
            if (key && value) {
                this.subsections[key] = value;
            }
        }
    }
    /**
     * Populates the subsection values accepting them from another class
     */
    accept(
        Name: string,
        Assignment: string,
        Collaborators: string,
        Date: string,
        Professor: string
    ): void {
        this.subsections = {
            Name,
            Assignment,
            Collaborators,
            Date,
            Professor
        };
        if (Name && Assignment && Collaborators && Date && Professor) {
            this.isComplete = true; // if all fields are filled, then the header is complete
        }
        else {
            this.isComplete = false; // if any field is empty, then the header is not complete
        }
    }

    /**
     * Generates HTML with injected subsection values using its created Header object
     */
    getHTML(): string {
        const { Name, Assignment, Collaborators, Date, Professor } = this.subsections;

        return `
        <div class="header">
            <div class="header-title">
                BOOP! ICS Summer 2025 | Professor <span class="professor-name">${Professor}</span>
            </div>
        </div>

        <div class="assignment-header">
            <div class="assignment-name">${Assignment}</div>
            <div class="student-name">${Name}</div>
            <div class="date">${Date}</div>
            <div class="collaborators">${Collaborators}</div>
        </div>`;
    }
}

class functionalCorrectness implements Section {
    subsections: { [key: string]: string };
    name: string;
    isComplete: boolean;

    constructor() {
        this.subsections = {
            Requires: "",
            Ensures: ""
        };
        this.name = "Functional Correctness";
        this.isComplete = false;
    }

    accept(): void { }

    parse(
        lines: string[]
    ): void {
        const len = lines.length;
        let counter = -1;
        for (let i = 0; i < len; i++) {
            const currentLine = lines[i];
            if (currentLine.toLowerCase().includes("requires") || currentLine.toLowerCase().includes("ensures")) {
                counter++;
                this.subsections[counter] = currentLine.split(':')[1].trim();
            }
            else {
                // For e.g. counter = 0 when we are in 'requires, the moment the subsection switches, count updates and we automatically starts populating the next clause (ensures)
                this.subsections[counter] = "\n" + currentLine;
            }
        }
        // If both subsections are filled, then the functional correctness section is complete
        this.isComplete = this.subsections.Requires && this.subsections.Ensures ? true : false;
    }

    getHTML(): string {
        return `<div class="blueprint-requires sub-section">
                    <span class="blueprint-requires-header">Requires: </span> <br>
                    ${this.subsections.Requires}
                </div>
                <div class="blueprint-ensures sub-section">
                    <span class="blueprint-ensures-header">Ensures: </span> <br>
                    ${this.subsections.Ensures}
                </div>`;
    }
}

class Complexity implements Section {
    subsections: { [key: string]: string };
    name: string;
    title: string;
    isComplete: boolean;
    HTML: string;

    constructor() {
        this.subsections = {
            Time: "",
            Space: ""
        };
        this.name = "Complexity";
        this.isComplete = false;
        this.title = "";
        this.HTML = "";
    }

    accept(
        title: string
    ): void {
        this.title = title.trim();
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
        this.isComplete = this.subsections.TimeComplexity ? true : false;
    }

    getHTML(): string {
        // This method should be implemented to return the HTML representation of the Complexity section
        return `
            <div class="time-complexity sub-section">
                <span class="time-complexity-header">Time Complexity: </span> <br>
                ${this.subsections.TimeComplexity}
            </div>
            <div class="space-complexity sub-section">
                <span class="space-complexity-header">Space Complexity: </span> <br>
                ${this.subsections.SpaceComplexity}
            </div>`;
    }
}

class I_o implements Section {
    subsections: { [key: string]: string[] };
    name: string;
    isComplete: boolean;

    constructor() {
        this.subsections = {
            Input: [],
            Output: []
        };
        this.name = "Input-Output";
        this.isComplete = false;
    }

    // Parses the content of the Input-Output section and updates the object fields accordingly
    parse(
        lines: string[]
    ): void {
        const len = lines.length;
        let currentSection = "";
        for (let i = 0; i < len; i++) {
            const currentLine = lines[i].trim();
            if (currentLine.toLowerCase().includes("input")) {
                // Require that an input must be followed by an output and no duplication.
                if (currentSection == "Input") {
                    vscode.window.showErrorMessage("Input section is already open. Please close it before opening a new one.");
                    return;
                }
                currentSection = "Input";
            } else if (currentLine.toLowerCase().includes("output")) {
                if (currentSection == "Output") {
                    vscode.window.showErrorMessage("Output section is already open. Please close it before opening a new one.");
                    return;
                }
                currentSection = "Output";
            } else if (currentSection) {
                this.subsections[currentSection].push(currentLine);
            }
        }
        // If both subsections are filled, then the input-output section is complete
        this.isComplete = this.subsections.Input.length > 0 && this.subsections.Output.length > 0;
    }

    accept(): void { }

    generate_i_o_HTML(): string {
        const len = this.subsections.Input.length;
        if (len != this.subsections.Output.length) {
            vscode.window.showErrorMessage("Every Input must have a corresponding Output and vice versa.");
            return "";
        }
        let HTML = "";
        for (let i = 0; i < len; i++) {
            HTML += `<span class="blueprint-input-header">Input: </span> <br> <span class="input-item">${this.subsections.Input[i]}<br></span>`;
            HTML += `<span class="blueprint-output-header">Output: </span> <br> <span class="input-item">${this.subsections.Output[i]}<br></span>`;
        }
        return HTML;
    }

    getHTML(): string {
        // This method should be implemented to return the HTML representation of the Input-Output section
        return `<div class="blueprint-input-output sub-section">
                    ${this.generate_i_o_HTML}
                </div>`;
    }
}

class Blueprint implements Section {
    subsections: { [key: string]: Section };
    name: string;
    /**
     * type:
     * - "any" if the type is not specified by the instructor
     * - "r-e" if the type is specified as functional correctness / requires-ensures clause
     * - "i-o" if the type is specified as input-output
     * type is used only for validation checks. 
     */
    type: string;
    HTML: string;
    isComplete: boolean;

    constructor() {
        this.subsections = {
            'fc': new functionalCorrectness(),
            'i_o': new I_o(),
            'complexity': new Complexity(),

        };
        this.type = "any"; // Type is any unless modified by instructor-given type
        this.name = "Blueprint";
        this.HTML = "";
        this.isComplete = false;
    }

    // Function below is used to update the instruction given type
    accept(
        type: string
    ): void {
        this.type = type;
    }

    // Takes in a string line and checks if it matches the type of the blueprint
    // Type any means there will never be a type mismatch
    typeMismatch(
        line: string
    ): boolean {
        if (this.type == "any")
            return false;
        // We want to see if the line contains an opening keyword that is not allowed by the type of the blueprint
        line = line.split(":")[1].toLowerCase();
        if (((line.includes("requires") || line.includes("ensures")) && this.type != "r-e")
            || (line.includes("input") || line.includes("output")) && this.type != "i-o") {
            return false
        }
        return true;
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
        let len = lines.length;
        const fcOpenRegex = /<<\s*functional-correctness\s*/i;
        const i_oOpenRegex = /<<\s*input-output\s*/i;
        const complexityOpenRegex = /<<\s*complexity\s*/i;
        const fcCoseRegex = /^\s*functional-correctness\s*>>$/i;
        const i_oCloseRegex = /^\s*input-output\s*>>$/i;
        const complexityCloseRegex = /^\s*complexity\s*>>$/i;

        for (let i = 0; i < len; i++) {
            let currentLine = lines[i];
            let currentLineLower = currentLine.toLowerCase().trim();
            // Stop parsing if there is a type mismatch. Individual checks are not further required.
            if (this.typeMismatch(currentLine)) {
                vscode.window.showErrorMessage(`Blueprint section type mismatch: ${currentLine}`);
                return;
            }
            // Check if the line starts with a keyword. If it does, create an object of the required section and let the class handle the rest
            if (fcOpenRegex.test(currentLineLower)) {
                let functionalCorrectnessContent = [];
                let functionalCorrectnessClosed = false;
                let j = i;
                for (j = i + 1; j < len; j++) {
                    if (fcCoseRegex.test(lines[j].toLowerCase())) {
                        functionalCorrectnessClosed = true;
                        break;
                    }
                    functionalCorrectnessContent.push(lines[j]);

                    if (functionalCorrectnessClosed) {
                        this.subsections['fc'].parse(functionalCorrectnessContent);
                        i = j; // Skip the lines that were parsed
                        this.HTML += this.subsections['fc'].getHTML() + "\n";
                    }
                    else {
                        vscode.window.showErrorMessage("Functional Correctness section is not closed properly.");
                        return;
                    }
                }
            }
            else if (i_oOpenRegex.test(currentLineLower)) {
                let i_o_content = [];
                let i_o_closed = false;
                let j = i;
                for (j = i + 1; j < len; j++) {
                    if (i_oCloseRegex.test(lines[j].toLowerCase())) {
                        i_o_closed = true;
                        break;
                    }
                    i_o_content.push(lines[j]);
                }
                if (i_o_closed) {
                    this.subsections['i_o'].parse(i_o_content);
                    i = j;
                    this.HTML += this.subsections['i_o'].getHTML() + "\n";
                } else {
                    vscode.window.showErrorMessage("Input section is not closed properly.");
                    return;
                }
            }
            else if (complexityOpenRegex.test(currentLineLower)) {
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
                    this.subsections['complexity'].parse(complexityContent);
                    i = j;
                    this.HTML += this.subsections['complexity'].getHTML() + "\n";
                } else {
                    vscode.window.showErrorMessage("Complexity section is not closed properly.");
                    return;
                }
            }
            // It is complete if at least one of the subsections is complete
            // Type mismatch checks have already been done so if a section is complete it means it obeys the type, and if a section is incomplete it does not obey the type
            this.isComplete = this.subsections['fc'].isComplete || this.subsections['i_o'].isComplete || this.subsections['complexity'].isComplete;
        }
    }

    getHTML(): string {
        // This method should be implemented to return the HTML representation of the Blueprint section
        return `<div class="section"> <div class="blueprint">
        ${this.HTML}
                </div>
                </div>`;
    }
}

class OperationalSteps implements Section {
    subsections: { [key: string]: string[] };
    name: string;
    isComplete: boolean;

    constructor() {
        this.subsections = {
            Steps: []
        };
        this.name = "Operational Steps";
        this.isComplete = false;
    }

    // Parses a given set of lines and populates the object field
    // The input is expected to be an array of strings, each representing a line in the Operational Steps section
    parse(
        lines: string[]
    ): void {
        const stepMatchRegex = /^\s*step\s*:\s*(.*)$/i;
        let len = lines.length;
        this.isComplete = len > 0;
        let currentStep: number = 0;
        for (let i = 0; i < len; i++) {
            const currentLine = lines[i];
            // Every line is either the opening of a new step, or a continuation of the previous step
            if (stepMatchRegex.test(currentLine))
                currentStep++;
            else
                this.subsections.Steps[currentStep] += "\n" + currentLine;
        }
    }

    // This method is not used currently because ops does not have any attributes like title, no.
    accept(steps: string[]): void {
    }

    // This method generates HTML for a single step, with the step number
    getStepHTML(step: string, index: number): string {
        return `<div class="step" id="step-${index}" >
                    <span class="step-number">Step ${index + 1}:</span>
                    <span class="step-content">${step}</span>
                </div>`;
    }

    getHTML(): string {
        // Generate HTML for all steps
        const stepsHTML = this.subsections.Steps.map((step, index) => this.getStepHTML(step, index)).join("");
        return `<div class="section">
        <div class="operational-steps">
                    <div class="operational-steps-content sub-section">
                        <span class="operational-steps-header">Steps: </span> <br>`
            + stepsHTML +
            `</div></div></div>`;
    }
}

class ocamlCode implements Section {
    subsections: { [key: string]: string };
    name: string;
    isComplete: boolean;
    HTML: string;

    constructor() {
        this.subsections = {
            Code: "",
            Status: ""
        };
        this.name = "Code";
        this.isComplete = false;
        this.HTML = "";
    }

    // Unused and empty function because the code field does not have any attributes like title, no. 
    accept(
        lines: string[]
    ): void {
    }
    // Sets the code content for the object and sends it to verify which verifies it and sets the status accordingly.
    parse(
        codeLines: string[]
    ): void {
        this.subsections.Code = codeLines.join("\n").trim();
        // If the code is not empty, then the section is complete
        this.isComplete = this.subsections.Code.length > 0;
        this.ocamlVerify();
    }
    // Updates the 'status' subsection appropriately based on the status of the code.
    // Assumes that the code content has already been populated
    ocamlVerify(): void {

        const ppxDir = path.resolve(__dirname, '../../ICSLang/ppx_1');
        const tempDir = ppxDir;
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const tempFile = path.join(ppxDir, `section_${Date.now()}.ml`);
        fs.writeFileSync(tempFile, this.subsections.Code, 'utf8');

        try {
            const result = execSync(`eval $(opam env)
        dune exec ./bin/checker.exe -- ${tempFile} ${allowed_flags}`, {
                encoding: 'utf-8',
                stdio: 'pipe',
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
                <div class="code-status>${this.subsections.Status}</div?
                    <div class="code sub-section">
                        <pre class="line-numbers"><code class="language-ocaml">
                        ${this.subsections.Code}</code></pre>
                    </div>
                </div>
            </div>`;
    }
}

class Induction implements Section {
    subsections: { [key: string]: string };
    name: string;
    isComplete: boolean;
    HTML: string;

    constructor() {
        this.subsections = {
            BaseCase: "",
            InductiveHypothesis: "",
            InductiveStep: ""
        };
        this.name = "Induction";
        this.isComplete = false;
        this.HTML = "";
    }

    // Parses lines to populate the subsection fields of the object
    parse(
        lines: string[]
    ): void {
        // This method parses the content of the Induction section
        const len = lines.length;
        for (let i = 0; i < len; i++) {
            const [key, value] = lines[i].split(':').map(part => part.trim());
            if (key && value) {
                this.subsections[key] = value;
            }
        }
        // If all subsections are filled, then the induction section is complete
        this.isComplete = this.subsections.BaseCase && this.subsections.InductiveHypothesis &&
            this.subsections.InductiveStep ? true : false;
    }

    // The below function is not currently used.
    accept(
        BaseCase: string,
        InductiveHypothesis: string,
        InductiveStep: string
    ): void {
        this.subsections = {
            BaseCase,
            InductiveHypothesis,
            InductiveStep
        };
        // If all subsections are filled, then the induction section is complete
        this.isComplete = BaseCase && InductiveHypothesis && InductiveStep ? true : false;
    }

    getHTML(): string {
        // This method should be implemented to return the HTML representation of the Induction section
        return `<div class="section">
                <div class="induction-header section-header">INDUCTION</div>
                <div class="induction">
                    <div class="base-case sub-section">
                        <span class="base-case-header">Base Case: </span> <br>
                        ${this.subsections.BaseCase}
                    </div>
                    <div class="inductive-hypothesis sub-section">
                        <span class="inductive-hypothesis-header">Inductive Hypothesis: </span> <br>
                        ${this.subsections.InductiveHypothesis}
                    </div>
                    <div class="inductive-step sub-section">
                        <span class="inductive-step-header">Inductive Step: </span> <br>
                        ${this.subsections.InductiveStep}
                    </div>
                </div>
            </div>`;
    }
}

class Invariant implements Section {
    subsections: { [key: string]: string };
    name: string;
    isComplete: boolean;
    HTML: string;

    constructor() {
        this.subsections = {
            Initialisation: "",
            Maintenance: "",
            Termination: ""
        };
        this.name = "Invariant";
        this.isComplete = false;
        this.HTML = "";
    }

    // The below function parses lines to populate the subsection fields of the object
    parse(
        lines: string[]
    ): void {
        // This method parses the content of the Invariant section
        const len = lines.length;
        for (let i = 0; i < len; i++) {
            const [key, value] = lines[i].split(':').map(part => part.trim());
            if (key && value) {
                this.subsections[key] = value;
            }
        }
        // If all subsections are filled, then the invariant section is complete
        this.isComplete = this.subsections.Initialisation && this.subsections.Maintenance &&
            this.subsections.Termination ? true : false;
    }

    // The below function is not currently used
    accept(
        Initialisation: string,
        Maintenance: string,
        Termination: string,
    ): void {
        this.subsections = {
            Initialisation,
            Maintenance,
            Termination
        };
        // If both subsections are filled, then the invariant section is complete
        this.isComplete = Initialisation && Maintenance && Termination ? true : false;
    }

    getHTML(): string {
        // This method should be implemented to return the HTML representation of the Invariant section
        return `<div class="section">
                <div class="invariant-header section-header">INVARIANT</div>
                <div class="invariant">
                    <div class="invariant initialisation sub-section">
                        <span class="invariant-initialisation">Invariant Statement: </span> <br>
                        ${this.subsections.Initialisation}
                    </div>
                    <div class="invariant maintenance sub-section">
                        <span class="invariant-maintenance">Maintenance: </span> <br>
                        ${this.subsections.Maintenance}
                    </div>
                    <div class="invariant termination sub-section">
                        <span class="invariant-termination">Termination: </span> <br>
                        ${this.subsections.Termination}
                    </div>
                </div>
            </div>`;
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

    constructor() {
        this.subsections = {
            Induction: new Induction(),
            Invariant: new Invariant()
        };
        this.name = "Proof";
        this.isComplete = false;
        this.HTML = "";
    }

    // Populates the two basic (and optional for the user) fields of the Proof section
    accept(
        isHelper: boolean,
        title: string
    ): void {
        this.isHelper = isHelper;
        this.title = title;
    }

    parse(
        lines: string[]
    ): void {
        const inductionOpenRegex = /<<\s*induction\s*:/i;
        const inductionCloseRegex = /^\s*induction\s*>>$/i;
        const invariantOpenRegex = /<<\s*invariant\s*:/i;
        const invariantCloseRegex = /^\s*invariant\s*>>$/i;
        const len = lines.length;

        for (let i = 0; i < len; i++) {
            const currentLine = lines[i];
            // Parse the content of each subsection based on the line
            if (inductionOpenRegex.test(currentLine)) {
                //Iterate to find the closing tag
                const inductionContent: string[] = []
                let inductionClosed = false;
                for (let j = i + 1; j < len; j++) {

                    if (inductionCloseRegex.test(lines[j])) {
                        inductionClosed = true;
                        break;
                    }
                    inductionContent.push(lines[j]);
                }
                if (inductionClosed) {
                    this.parse(inductionContent);
                } else {
                    vscode.window.showErrorMessage("Induction section is not closed properly.");
                }
            }
            else if (invariantOpenRegex.test(currentLine)) {
                //Iterate to find the closing tag
                const invariantContent: string[] = [];
                let invariantClosed = false;
                for (let j = i + 1; j < len; j++) {
                    if (invariantCloseRegex.test(lines[j])) {
                        invariantClosed = true;
                        break;
                    }
                    invariantContent.push(lines[j]);
                }
                if (invariantClosed) {
                    this.parse(invariantContent);
                } else {
                    vscode.window.showErrorMessage("Invariant section is not closed properly.");
                }
            }
        }

    }
    // The below methods accept Invariant / Induction content and update the respective subsection objects
    // acceptInductionContent(
    //     BaseCase: string,
    //     InductiveHypothesis: string,
    //     InductiveStep: string
    // ): void {
    //     const induction = new Induction();
    //     induction.acceptSubsectionContent(BaseCase, InductiveHypothesis, InductiveStep);
    //     this.subsections.Induction = induction;
    //     this.isComplete = true;
    // }

    // accept(
    //     Initialisation: string,
    //     Maintenance: string,
    //     Termination: string
    // ): void {
    //     const invariant = new Invariant();
    //     invariant.acceptSubsectionContent(Initialisation, Maintenance, Termination);
    //     this.subsections.Invariant = invariant;
    //     this.isComplete = true;
    // }

    getHTML(): string {
        if (this.subsections.Induction.isComplete) {
            return `<div class="section">
                <div class="proof-header section-header">PROOF</div>
                <div class="proof">
                    <div class="proof-content sub-section">
                        ${this.subsections.Induction}
                    </div>
                </div>
            </div>`;
        }
        else if (this.subsections.Invariant.isComplete) {
            // This method should be implemented to return the HTML representation of the Proof section
            return `<div class="section">
                <div class="proof-header section-header">PROOF</div>
                <div class="proof">
                    <div class="proof-content sub-section">
                        ${this.subsections.Invariant}
                    </div>
                </div>
            </div>`;
        }
        return "";
    }
}

class textAnswer implements Section {
    subsections: { [key: string]: string };
    name: string;
    title: string;
    isComplete: boolean;

    constructor() {
        this.subsections = {
            Answer: ""
        };
        this.name = "Text Answer";
        this.title = "";
        this.isComplete = false;
    }

    // Accepts the answer content and updates the object fields accordingly
    accept(
        title: string
    ): void {
        this.subsections.Answer = title.trim();
    }

    parse(
        lines: string[]
    ): void {
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
                        ${this.subsections.Answer}
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
    number: number;
    isComplete: boolean;
    HTML: string;
    // Right now we are not having a Section[] for Proof / Text Answer so we generate on the go
    // But in the future it is suggested to maintain Section[] for Proof and Text Answer
    proofHTML: string;
    textAnswerHTML: string;

    constructor() {
        this.subsections = {
            Blueprint: new Blueprint(),
            OperationalSteps: new OperationalSteps(),
            Code: new ocamlCode(),
            Proof: new Proof(),
            Complexity: new Complexity(),
            TextAnswer: new textAnswer()
        };
        this.name = "Problem";
        this.isComplete = false;
        this.proofHTML = "";
        this.textAnswerHTML = "";
        this.title = "";
        this.number = 0;
        this.HTML = "";
    }

    // This method parses the content of the Problem section, updates the objects of its subsections and the boolean to indicate whether the problem is complete
    parse(
        lines: string[]
    ): void {
        const blueprintOpenRegex = /<<\s*blueprint\s*:/i;
        const bluePrintCloseRegex = /^\s*blueprint\s*>>$/i;
        const operationalStepsOpenRegex = /<<\s*operational-steps\s*:/i;
        const operationalStepsCloseRegex = /^\s*operational-steps\s*>>$/i;
        const codeOpenRegex = /<<\s*ocaml-code\s*:/i;
        const codeCloseRegex = /^\s*ocaml-code\s*>>$/i;
        const proofOpenRegex = /<<\s*proof\s*:/i;
        const proofCloseRegex = /^\s*proof\s*>>$/i;
        const textAnswerOpenRegex = /<<\s*text-answer\s*:/i;
        const textAnswerCloseRegex = /^\s*text-answer\s*>>$/i;
        const len = lines.length;

        for (let i = 0; i < len; i++) {
            const currentLine = lines[i];
            // Parse the content of each subsection based on the line
            // Blueprint only appears once in every problem
            if (!this.subsections.Blueprint.isComplete && blueprintOpenRegex.test(currentLine)) {
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
                    blueprint.parse(blueprintContent);
                    this.subsections.Blueprint = blueprint;
                } else {
                    vscode.window.showErrorMessage("Blueprint section is not closed properly.");
                }

            }
            // Operational Steps only appears once in every problem
            else if (!this.subsections.OperationalSteps.isComplete && operationalStepsOpenRegex.test(currentLine)) {
                //Iterate to find the closing tag
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
                    const operationalSteps = this.subsections.OperationalSteps;
                    operationalSteps.accept(operationalStepsContent);
                    i = j;
                } else {
                    vscode.window.showErrorMessage("Operational Steps section is not closed properly.");
                }

            }
            // Ocaml code only appears once in every problem
            else if (!this.subsections.ocaml_code.isComplete && codeOpenRegex.test(currentLine)) {
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
                    this.subsections.Code.parse(codeContent);
                    i = j;
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
                    proof.accept(isHelper, title);
                    proof.parse(proofContent);
                    // Since we aren't keeping track of multiple proof objects, we collate the HTML as we go
                    this.proofHTML += proof.getHTML() + "\n";
                    i = j;
                } else {
                    vscode.window.showErrorMessage("Proof section is not closed properly.");
                }
            }
            else if (textAnswerOpenRegex.test(currentLine)) {
                //Iterate to find the closing tag
                const textAnswerContent: string[] = [];
                let textAnswerClosed = false;
                // Extract the title 
                const titleMatch = currentLine.match(/<<\s*text-answer\s*:\s*(.*)\s*/i);
                let j = i;
                if (!titleMatch) {
                    vscode.window.showErrorMessage("Text Answer section title is not specified.");
                    return;
                }
                for (j = i + 1; j < len; j++) {
                    if (textAnswerCloseRegex.test(lines[j])) {
                        textAnswerClosed = true;
                        break;
                    }
                    textAnswerContent.push(lines[j]);
                }
                if (textAnswerClosed) {
                    this.subsections.TextAnswer.accept(titleMatch ? titleMatch[1] : "");
                    this.subsections.TextAnswer.parse(textAnswerContent);
                    i = j;
                    // Since we aren't keeping track of multiple text answer objects, we collate the HTML as we go
                    this.textAnswerHTML += this.subsections.TextAnswer.getHTML() + "\n";
                } else {
                    vscode.window.showErrorMessage("Text Answer section is not closed properly.");
                }
            }
        }

        if ((this.subsections.Blueprint.isComplete && this.subsections.OperationalSteps.isComplete &&
            this.subsections.Code.isComplete && this.subsections.Proof.isComplete) || this.subsections.TextAnswer.isComplete) {
            this.isComplete = true;
        }
    }

    accept(
        title: string,
        number: number,
    ): void {
        this.title = title;
        this.number = number;
    }

    getHTML(): string {
        // This method should be implemented to return the HTML representation of the Problem section
        return `<div class="problem">
                    <div class="problem-title">${this.number}: ${this.title}</div>
                    ${this.subsections.Blueprint.getHTML()}
                    ${this.subsections.OperationalSteps.getHTML()}
                    ${this.subsections.Code.getHTML()}
                    ${this.proofHTML}
                    ${this.textAnswerHTML}
                </div>`;
    }
}

class Document {
    header = new Header();
    assignmentNumber: number;
    problems: Problem[];
    isComplete: boolean;
    HTML: string;

    constructor() {
        this.header = new Header();
        this.problems = [];
        this.isComplete = false;
        this.HTML = "";
        this.assignmentNumber = 0;
    }

    acceptHeaderContent(
        Name: string,
        Assignment: string,
        Collaborators: string,
        Date: string,
        Professor: string
    ): void {
        this.header.accept(Name, Assignment, Collaborators, Date, Professor);
    }

    acceptProblems(problems: Problem[]): void {
        this.problems = problems;
        this.isComplete = this.header.isComplete && this.problems.every(p => p.isComplete);
    }

    // Adds a new problem to the document
    // Do not worry about HTML generation right now, HTML generation is only done in getHTML
    // An alternative is to generate as you go
    addProblem(problem: Problem): void {
        this.problems.push(problem);
        this.isComplete = this.isComplete && problem.isComplete;
    }

    // Parse the JSON, extract the criterion and check it against the relevant objects
    checkAssignmentCriteria(): boolean {
        const jsonFile = path.join(__dirname, `../../ICSLang/assignment_${this.assignmentNumber}.json`);
        const parsed = JSON.parse(jsonFile)
        console.log(`Parsed JSON: ${JSON.stringify(parsed)}`);
        const problem_allowances: ({ [key: string]: Section } | string)[][] = [];

        if (!fs.existsSync(jsonFile)) {
            vscode.window.showErrorMessage(`Assignment criteria file not found: ${jsonFile}`);
            return false;
        }

        // parse the JSON and populate problem_allowances 
        for (let item in parsed) {

        }
        return true;
    }

    private generateCSS(): string {
        return `:root {
    --blue: #3674B5;
    --purple: #7F55B1;
    --orange: #ef7f08;
    --green: #096B68;
}

* {
    font-family: 'Courier New', Courier, monospace;
}

body {
    display: flex;
    flex-direction: column;
    font-weight: 550;
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
    font-weight: 1000;
    background-color: var(--blue);
    color: white;
    padding: 5px;
    border-radius: 5px;
    opacity: 0.8;
}

.step-header {
    background-color: var(--purple);
}

.invariant-header {
    background-color: var(--green);
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

.line-numbers > code {
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
    opacity 0.5;
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
    opacity 0.5;
    margin-left: 10px
    text-align: center;
    margin-bottom: 5px;
}
`;
    }

    getHTML(): string {
        // This method should be implemented to return the HTML representation of the Document
        this.HTML = this.problems.map(problem => problem.getHTML()).join("");
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
        this.outputPath = this.resolveOutputPath(
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd()
        );
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
        // Parse the document to create a Document object
        const parsedDocument = this.parseDocument(document);

        // Check if the document is complete
        if (!parsedDocument.isComplete) {
            vscode.window.showErrorMessage("Document is not complete. Please fill in all required sections.");
            return;
        }

        // Generate HTML from the Document object
        const htmlContent = this.getHTML(parsedDocument);

        // Write the HTML content to a file
        const outputPath = this.getOutputPath(document.fileName);
        const outputFileName = path.join(outputPath, `${path.basename(document.fileName, '.ics')}.html`);

        try {
            await vscode.workspace.fs.writeFile(vscode.Uri.file(outputFileName), Buffer.from(htmlContent, 'utf8'));
            vscode.window.showInformationMessage(`Compiled successfully! Output written to ${outputFileName}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to write output file!`);
        }
    }

    private parseDocument(document: vscode.TextDocument): Document {
        const doc = new Document();
        const lines = document.getText().split('\n');
        const headerOpenRegex = /<<\s*header\s*:/i;
        const headerCloseRegex = /^\s*header\s*>>$/i;
        const problemOpenRegex = /<<\s*problem\s*:/i;
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
                } else {
                    vscode.window.showErrorMessage("Header section is not closed properly.");
                }
            }

            if (problemOpenRegex.test(currentLine)) {
                // Extract problem number and title
                const problemInfo = currentLine.match(/<<\s*problem\s*:\s*(\d+)\s*:\s*(.*)\s*>>/i);
                if (problemInfo && problemInfo.length === 3) {

                    // Create a new Problem object
                    const problemNumber = parseInt(problemInfo[1], 10);
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
                        doc.problems.push(problem);
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
 * 2. Do not create unnecessary objects
 * 5. Don't raise vs code window errors for everything
 * 8. Handle newlines
 * 9. Ensure nested sections would function as expected
 * 10. Fix inefficient string concatenation in HTML generation
 * 11. Make a generate JSON interface for instructors 
 * 12. Connect with validator.ts to use isComplete to validate 
 * 13. Fix header accept and parse functions switch up
 */