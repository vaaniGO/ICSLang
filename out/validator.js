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
    constructor() {
        this.VALID_TAGS = [
            'problem', 'blueprint', 'ocaml-code', 'proof', 'functional-correctness',
            'complexity', 'input-output', 'induction', 'invariant', 'operational-steps', 'header'
        ];
        this.REQUIRED_SUBTAGS = new Map([
            ['functional-correctness', ['requires:', 'ensures:']],
            ['input-output', ['input:', 'output:']],
            ['complexity', ['time:']],
            ['induction', ['base case:', 'inductive hypothesis:', 'inductive step:']],
            ['invariant', ['initialisation:', 'maintenance:', 'termination:']],
            ['operational-steps', ['step 1:']]
        ]);
        // Tags that must be within blueprint
        this.BLUEPRINT_REQUIRED_TAGS = ['functional-correctness', 'complexity', 'input-output'];
        // Tags that must be within proof
        this.PROOF_REQUIRED_TAGS = ['induction', 'invariant'];
    }
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
        // Track all sections globally
        const allSections = new Map();
        // Track current contexts
        let inProblem = false;
        let problemLine = -1;
        let inBlueprint = false;
        let blueprintLine = -1;
        let inProof = false;
        let proofLine = -1;
        // Process each line
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Skip empty lines
            if (!line)
                continue;
            // Check for opening tags: <<tagname or <<problem number title
            const openMatch = line.match(/^<<(.+)$/);
            if (openMatch) {
                const tagContent = openMatch[1].trim();
                let tagName;
                // Special handling for problem tag with number and title
                if (tagContent.match(/^problem\s+\d+/)) {
                    tagName = 'problem';
                }
                else {
                    tagName = tagContent.toLowerCase();
                }
                // Validate tag name
                if (!this.VALID_TAGS.includes(tagName)) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), `Invalid tag '${tagName}'. Valid tags are: ${this.VALID_TAGS.join(', ')}`, vscode.DiagnosticSeverity.Error));
                    continue;
                }
                // Check if tag is already open
                if (allSections.has(tagName) && allSections.get(tagName).opened && !allSections.get(tagName).closed) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), `Tag '${tagName}' is already opened at line ${allSections.get(tagName).line + 1}`, vscode.DiagnosticSeverity.Error));
                    continue;
                }
                // Validate problem tag format
                if (tagName === 'problem') {
                    if (!tagContent.match(/^problem\s+\d+:\s+.+/)) {
                        diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), `Problem tag must contain a number and title. Format: <<problem number title`, vscode.DiagnosticSeverity.Error));
                        continue;
                    }
                    if (inProblem) {
                        diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), `Problem tag is already opened at line ${problemLine + 1}`, vscode.DiagnosticSeverity.Error));
                        continue;
                    }
                    inProblem = true;
                    problemLine = i;
                }
                else if (tagName === 'header') {
                    allSections.set(tagName, { opened: true, line: i, closed: false });
                    continue;
                }
                else {
                    // All other tags must be inside a problem
                    if (!inProblem) {
                        diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), `Tag '${tagName}' must be inside a problem tag`, vscode.DiagnosticSeverity.Error));
                        continue;
                    }
                    // Check blueprint context requirements
                    if (this.BLUEPRINT_REQUIRED_TAGS.includes(tagName)) {
                        if (!inBlueprint) {
                            diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), `Tag '${tagName}' must be inside a blueprint tag`, vscode.DiagnosticSeverity.Error));
                            continue;
                        }
                    }
                    // Check proof context requirements
                    if (this.PROOF_REQUIRED_TAGS.includes(tagName)) {
                        if (!inProof) {
                            diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), `Tag '${tagName}' must be inside a proof tag`, vscode.DiagnosticSeverity.Error));
                            continue;
                        }
                    }
                    // Track blueprint and proof contexts
                    if (tagName === 'blueprint') {
                        inBlueprint = true;
                        blueprintLine = i;
                    }
                    else if (tagName === 'proof') {
                        inProof = true;
                        proofLine = i;
                    }
                }
                // Record the opened section
                allSections.set(tagName, { opened: true, line: i, closed: false });
                continue;
            }
            // Check for closing tags: tagname>>
            const closeMatch = line.match(/^(.+)>>$/);
            if (closeMatch) {
                const tagName = closeMatch[1].toLowerCase().trim();
                // Check if this is a valid tag
                if (!this.VALID_TAGS.includes(tagName)) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), `Invalid closing tag '${tagName}'`, vscode.DiagnosticSeverity.Error));
                    continue;
                }
                // Check if tag was opened
                if (!allSections.has(tagName) || !allSections.get(tagName).opened) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), `Closing tag '${tagName}' found but tag was never opened`, vscode.DiagnosticSeverity.Error));
                    continue;
                }
                // Check if tag is already closed
                if (allSections.get(tagName).closed) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), `Tag '${tagName}' is already closed`, vscode.DiagnosticSeverity.Error));
                    continue;
                }
                // Mark as closed
                allSections.get(tagName).closed = true;
                // Update context tracking
                if (tagName === 'problem') {
                    inProblem = false;
                    problemLine = -1;
                    // Reset nested contexts when problem closes
                    inBlueprint = false;
                    inProof = false;
                }
                else if (tagName === 'blueprint') {
                    inBlueprint = false;
                    blueprintLine = -1;
                }
                else if (tagName === 'proof') {
                    inProof = false;
                    proofLine = -1;
                }
                // Validate required subtags before closing
                if (this.REQUIRED_SUBTAGS.has(tagName)) {
                    this.validateSubtags(document, allSections.get(tagName).line, i, tagName, diagnostics);
                }
                continue;
            }
        }
        // Check for unclosed tags
        for (const [tagName, state] of allSections) {
            if (state.opened && !state.closed) {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(state.line, 0, state.line, lines[state.line] ? lines[state.line].length : 0), `Tag '${tagName}' is not closed`, vscode.DiagnosticSeverity.Error));
            }
        }
        return diagnostics;
    }
    validateSubtags(document, startLine, endLine, tagName, diagnostics) {
        const requiredSubtags = this.REQUIRED_SUBTAGS.get(tagName);
        if (!requiredSubtags)
            return;
        const content = document.getText();
        const lines = content.split('\n');
        const foundSubtags = new Set();
        // Check content between start and end lines
        for (let i = startLine + 1; i < endLine; i++) {
            const line = lines[i].toLowerCase().trim();
            for (const subtag of requiredSubtags) {
                if (line.includes(subtag)) {
                    foundSubtags.add(subtag);
                }
            }
            // Special handling for operational-steps to find any step number
            if (tagName === 'operational-steps') {
                const stepMatch = line.match(/step\s+(\d+):/);
                if (stepMatch) {
                    const stepNum = parseInt(stepMatch[1]);
                    if (stepNum >= 1) {
                        foundSubtags.add('step 1:'); // Mark as satisfied if any step >= 1 is found
                    }
                }
            }
            // Special handling for input-output (multiple pairs allowed)
            if (tagName === 'input-output') {
                if (line.includes('input:')) {
                    foundSubtags.add('input:');
                }
                if (line.includes('output:')) {
                    foundSubtags.add('output:');
                }
            }
        }
        // Check for missing required subtags
        const missingSubtags = requiredSubtags.filter(subtag => !foundSubtags.has(subtag));
        if (missingSubtags.length > 0) {
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(endLine, 0, endLine, 10), `Tag '${tagName}' is missing required subtags: ${missingSubtags.join(', ')}`, vscode.DiagnosticSeverity.Error));
        }
    }
    // Enhanced syntax highlighting
    provideDocumentSemanticTokens(document) {
        const tokensBuilder = new vscode.SemanticTokensBuilder();
        const content = document.getText();
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            // Highlight problem tags
            if (trimmed.match(/^<<problem\s+\d+/) || trimmed === 'problem>>') {
                tokensBuilder.push(new vscode.Range(i, 0, i, line.length), 'keyword', ['red']);
            }
            // Highlight blueprint tags
            else if (trimmed === '<<blueprint' || trimmed === 'blueprint>>') {
                tokensBuilder.push(new vscode.Range(i, 0, i, line.length), 'keyword', ['blue']);
            }
            // Highlight proof tags
            else if (trimmed === '<<proof' || trimmed === 'proof>>') {
                tokensBuilder.push(new vscode.Range(i, 0, i, line.length), 'keyword', ['green']);
            }
            // Highlight ocaml-code tags
            else if (trimmed === '<<ocaml-code' || trimmed === 'ocaml-code>>') {
                tokensBuilder.push(new vscode.Range(i, 0, i, line.length), 'keyword', ['orange']);
            }
            // Highlight other opening and closing tags
            else if (trimmed.match(/^<<[^>]+$/) || trimmed.match(/^[^<]+>>$/)) {
                tokensBuilder.push(new vscode.Range(i, 0, i, line.length), 'keyword', ['purple']);
            }
        }
        return tokensBuilder.build();
    }
}
exports.ICSValidator = ICSValidator;
//# sourceMappingURL=validator.js.map