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
exports.ICSValidator = void 0;
const vscode = __importStar(require("vscode"));
class ICSValidator {
    validate(document) {
        const diagnostics = this.getDiagnostics(document);
        if (diagnostics.length > 0) {
            const errorMessages = diagnostics.map(d => d.message).join('\n');
            vscode.window.showErrorMessage(`ICS Validation failed:\n${errorMessages}`);
        }
        else {
            vscode.window.showInformationMessage('ICS document is valid!');
        }
    }
    getDiagnostics(document) {
        const diagnostics = [];
        const content = document.getText();
        const lines = content.split('\n');
        // Track sections and their states - reset for each problem
        let sectionStates = new Map();
        const requiredSubsections = new Map();
        let foundSubsections = new Map();
        // Define required subsections for each section type
        requiredSubsections.set('blueprint', ['requires', 'ensures']);
        requiredSubsections.set('induction', ['base case', 'induction hypothesis', 'inductive step']);
        requiredSubsections.set('invariant', ['pre-condition', 'after the ith step', 'after the (i+1)th step', 'post-condition']);
        requiredSubsections.set('header', ['assignment', 'student', 'date', 'collaborators']);
        // Track section hierarchy - use a stack to handle nested sections
        let sectionStack = [];
        let currentProofType = null;
        // Track header information found outside of header section
        const headerInfoOutsideSection = new Map();
        let headerSectionFound = false;
        let inProblem = false;
        let inHeader = false;
        // Helper function to reset problem-specific state
        const resetProblemState = () => {
            sectionStates = new Map();
            foundSubsections = new Map();
            sectionStack = [];
            currentProofType = null;
        };
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Check for problem start
            const problemStartMatch = line.match(/^<<problem\s+(.+)$/);
            if (problemStartMatch) {
                // Validate any unclosed sections from previous problem
                if (inProblem) {
                    this.validateUnclosedSections(sectionStates, lines, diagnostics);
                }
                // Reset state for new problem
                resetProblemState();
                inProblem = true;
                continue;
            }
            // Check for problem end
            if (line === 'problem>>' && inProblem) {
                // Validate unclosed sections for current problem
                this.validateUnclosedSections(sectionStates, lines, diagnostics);
                // Reset state after problem ends
                resetProblemState();
                inProblem = false;
                continue;
            }
            // Check for header section start
            if (line === '<<header') {
                inHeader = true;
                headerSectionFound = true;
                sectionStates.set('header', { opened: true, line: i, closed: false });
                sectionStack.push('header');
                foundSubsections.set('header', new Set());
                continue;
            }
            // Check for header section end
            if (line === 'header>>' && inHeader) {
                inHeader = false;
                if (sectionStates.has('header')) {
                    sectionStates.get('header').closed = true;
                    this.validateRequiredSubsections('header', foundSubsections.get('header') || new Set(), requiredSubsections.get('header') || [], diagnostics, i);
                }
                sectionStack.pop();
                continue;
            }
            // Skip non-problem content if not in header
            if (!inProblem && !inHeader) {
                continue;
            }
            // Check for section opening - fixed syntax: <<keyword
            const openSectionMatch = line.match(/^<<(blueprint|operational steps|ocaml code|proof|induction|invariant)$/);
            if (openSectionMatch) {
                const sectionName = openSectionMatch[1];
                // Check if section was already opened in current problem
                if (sectionStates.has(sectionName) && sectionStates.get(sectionName).opened && !sectionStates.get(sectionName).closed) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), `Section '${sectionName}' is already opened at line ${sectionStates.get(sectionName).line + 1}`, vscode.DiagnosticSeverity.Error));
                    continue;
                }
                sectionStates.set(sectionName, { opened: true, line: i, closed: false });
                sectionStack.push(sectionName);
                // Initialize subsection tracking
                if (requiredSubsections.has(sectionName)) {
                    foundSubsections.set(sectionName, new Set());
                }
                // Special handling for proof sections
                if (sectionName === 'induction' || sectionName === 'invariant') {
                    currentProofType = sectionName;
                    foundSubsections.set(sectionName, new Set());
                }
                else if (sectionName === 'proof') {
                    // For generic proof sections, we don't set currentProofType
                    currentProofType = null;
                }
                continue;
            }
            // Check for section closing - fixed syntax: keyword>>
            const closeSectionMatch = line.match(/^(blueprint|operational steps|ocaml code|proof|induction|invariant)>>$/);
            if (closeSectionMatch) {
                const sectionName = closeSectionMatch[1];
                // Check if section exists and is opened
                if (!sectionStates.has(sectionName) || !sectionStates.get(sectionName).opened) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), `Closing tag for '${sectionName}' found but section was never opened`, vscode.DiagnosticSeverity.Error));
                    continue;
                }
                // Check if section is already closed
                if (sectionStates.get(sectionName).closed) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), `Closing tag for '${sectionName}' found but section is already closed`, vscode.DiagnosticSeverity.Error));
                    continue;
                }
                // Check if we're in the right section context
                if (sectionStack.length === 0) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), `Closing tag for '${sectionName}' found but currently in section null`, vscode.DiagnosticSeverity.Error));
                    continue;
                }
                // Find the section in the stack (handle nested sections)
                let sectionIndex = -1;
                for (let j = sectionStack.length - 1; j >= 0; j--) {
                    if (sectionStack[j] === sectionName) {
                        sectionIndex = j;
                        break;
                    }
                }
                if (sectionIndex === -1) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), `Closing tag for '${sectionName}' found but section is not in current context. Current stack: [${sectionStack.join(', ')}]`, vscode.DiagnosticSeverity.Error));
                    continue;
                }
                // Mark section as closed
                sectionStates.get(sectionName).closed = true;
                // Validate required subsections
                this.validateRequiredSubsections(sectionName, foundSubsections.get(sectionName) || new Set(), requiredSubsections.get(sectionName) || [], diagnostics, i);
                // Remove from stack (remove this section and any nested ones)
                sectionStack.splice(sectionIndex);
                if (sectionName === 'induction' || sectionName === 'invariant') {
                    currentProofType = null;
                }
                continue;
            }
            // Check for header information outside of header section
            if (!inHeader && (sectionStack.length === 0 || sectionStack[sectionStack.length - 1] !== 'header')) {
                this.checkHeaderInfoOutsideSection(line, i, headerInfoOutsideSection, diagnostics);
            }
            // Check for subsections
            const currentSection = sectionStack.length > 0 ? sectionStack[sectionStack.length - 1] : null;
            if (currentSection && (inProblem || inHeader)) {
                this.checkSubsections(line, currentSection, currentProofType, foundSubsections, i, diagnostics);
            }
            // Check for step references
            if (inProblem) {
                this.validateStepReferences(line, document, i, diagnostics);
            }
        }
        // Final validation for unclosed sections
        this.validateUnclosedSections(sectionStates, lines, diagnostics);
        // Check if header section exists
        if (!headerSectionFound) {
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), `Document must contain a header section enclosed in <<header and header>> tags`, vscode.DiagnosticSeverity.Error));
        }
        return diagnostics;
    }
    // Helper method to validate unclosed sections
    validateUnclosedSections(sectionStates, lines, diagnostics) {
        for (const [sectionName, state] of sectionStates) {
            if (state.opened && !state.closed) {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(state.line, 0, state.line, lines[state.line] ? lines[state.line].length : 0), `Section '${sectionName}' is not closed`, vscode.DiagnosticSeverity.Error));
            }
        }
    }
    checkHeaderInfoOutsideSection(line, lineNumber, headerInfoOutsideSection, diagnostics) {
        const headerFields = ['assignment:', 'student:', 'date:', 'collaborators:', 'problem:'];
        for (const field of headerFields) {
            if (line.toLowerCase().includes(field)) {
                headerInfoOutsideSection.set(field, lineNumber);
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(lineNumber, 0, lineNumber, line.length), `Header information '${field}' must be enclosed within <<header and header>> tags`, vscode.DiagnosticSeverity.Error));
                break; // Only report one error per line
            }
        }
    }
    checkSubsections(line, currentSection, currentProofType, foundSubsections, lineNumber, diagnostics) {
        // Check for blueprint subsections
        if (currentSection === 'blueprint') {
            if (line.toLowerCase().includes('requires:')) {
                foundSubsections.get('blueprint')?.add('requires');
            }
            else if (line.toLowerCase().includes('ensures:')) {
                foundSubsections.get('blueprint')?.add('ensures');
            }
        }
        // Check for header subsections - fixed to use regex for more flexible matching
        if (currentSection === 'header') {
            const lowerLine = line.toLowerCase();
            if (lowerLine.match(/assignment\s*:/)) {
                foundSubsections.get('header')?.add('assignment');
            }
            else if (lowerLine.match(/student\s*:/)) {
                foundSubsections.get('header')?.add('student');
            }
            else if (lowerLine.match(/date\s*:/)) {
                foundSubsections.get('header')?.add('date');
            }
            else if (lowerLine.match(/collaborators\s*:/)) {
                foundSubsections.get('header')?.add('collaborators');
            }
        }
        // Check for proof subsections
        if (currentProofType === 'induction') {
            if (line.toLowerCase().includes('base case:')) {
                foundSubsections.get('induction')?.add('base case');
            }
            else if (line.toLowerCase().includes('induction hypothesis:')) {
                foundSubsections.get('induction')?.add('induction hypothesis');
            }
            else if (line.toLowerCase().includes('inductive step:')) {
                foundSubsections.get('induction')?.add('inductive step');
            }
        }
        else if (currentProofType === 'invariant') {
            if (line.toLowerCase().includes('pre-condition:')) {
                foundSubsections.get('invariant')?.add('pre-condition');
            }
            else if (line.toLowerCase().includes('after the ith step:')) {
                foundSubsections.get('invariant')?.add('after the ith step');
            }
            else if (line.toLowerCase().includes('after the (i+1)th step:')) {
                foundSubsections.get('invariant')?.add('after the (i+1)th step');
            }
            else if (line.toLowerCase().includes('post-condition:')) {
                foundSubsections.get('invariant')?.add('post-condition');
            }
        }
    }
    validateRequiredSubsections(sectionName, foundSubsections, requiredSubsections, diagnostics, lineNumber) {
        const missingSubsections = requiredSubsections.filter(sub => !foundSubsections.has(sub));
        if (missingSubsections.length > 0) {
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(lineNumber, 0, lineNumber, 10), `Section '${sectionName}' is missing required subsections: ${missingSubsections.join(', ')}`, vscode.DiagnosticSeverity.Error));
        }
    }
    getAvailableSteps(document) {
        const steps = [];
        const content = document.getText();
        const lines = content.split('\n');
        let inOperationalSteps = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '<<operational steps') {
                inOperationalSteps = true;
                continue;
            }
            if (inOperationalSteps && trimmed === 'operational steps>>') {
                inOperationalSteps = false;
                continue;
            }
            if (inOperationalSteps) {
                // Fixed regex to handle 'step [number]:' format
                const stepMatch = trimmed.match(/^\s*step\s+(\d+)\s*[.:]?\s*/i);
                if (stepMatch) {
                    steps.push(parseInt(stepMatch[1]));
                }
            }
        }
        return steps;
    }
    validateStepReferences(line, document, lineNumber, diagnostics) {
        const stepReferences = line.match(/step (\d+)/g);
        if (!stepReferences)
            return;
        const availableSteps = this.getAvailableSteps(document);
        for (const stepRef of stepReferences) {
            const stepMatch = stepRef.match(/step (\d+)/);
            if (stepMatch) {
                const stepNumber = parseInt(stepMatch[1]);
                if (!availableSteps.includes(stepNumber)) {
                    const startChar = line.indexOf(stepRef);
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(lineNumber, startChar, lineNumber, startChar + stepRef.length), `Step ${stepNumber} is referenced but not defined in operational steps`, vscode.DiagnosticSeverity.Warning));
                }
            }
        }
    }
    // Method to provide syntax highlighting tokens
    provideDocumentSemanticTokens(document) {
        const tokensBuilder = new vscode.SemanticTokensBuilder();
        const content = document.getText();
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            // Check for section headers
            if (trimmed.match(/^<<blueprint$/) || trimmed.match(/^blueprint>>$/)) {
                tokensBuilder.push(new vscode.Range(i, 0, i, line.length), 'keyword', ['blue']);
            }
            else if (trimmed.match(/^<<operational steps$/) || trimmed.match(/^operational steps>>$/)) {
                tokensBuilder.push(new vscode.Range(i, 0, i, line.length), 'keyword', ['purple']);
            }
            else if (trimmed.match(/^<<ocaml code$/) || trimmed.match(/^ocaml code>>$/)) {
                tokensBuilder.push(new vscode.Range(i, 0, i, line.length), 'keyword', ['orange']);
            }
            else if (trimmed.match(/^<<(proof|induction|invariant)$/) || trimmed.match(/^(proof|induction|invariant)>>$/)) {
                tokensBuilder.push(new vscode.Range(i, 0, i, line.length), 'keyword', ['green']);
            }
            else if (trimmed.match(/^<<header$/) || trimmed.match(/^header>>$/)) {
                tokensBuilder.push(new vscode.Range(i, 0, i, line.length), 'keyword', ['cyan']);
            }
        }
        return tokensBuilder.build();
    }
}
exports.ICSValidator = ICSValidator;
//# sourceMappingURL=validator.js.map