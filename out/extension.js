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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const compiler_1 = require("./compiler");
const assignment_1_1 = require("./assignment-1");
const validator_1 = require("./validator");
let client;
function activate(context) {
    console.log('ICS Language Support extension is now active!');
    // Register completion provider
    const completionProvider = vscode.languages.registerCompletionItemProvider('ics', new ICSCompletionProvider(), '<', // Trigger on < for <<sections
    's' // Trigger on 's' for step references
    );
    // Register hover provider for step references
    const hoverProvider = vscode.languages.registerHoverProvider('ics', new ICSHoverProvider());
    // Register definition provider for step references
    const definitionProvider = vscode.languages.registerDefinitionProvider('ics', new ICSDefinitionProvider());
    // Register semantic tokens provider for syntax highlighting
    const semanticTokensProvider = vscode.languages.registerDocumentSemanticTokensProvider('ics', new ICSSemanticTokensProvider(), new vscode.SemanticTokensLegend(['keyword', 'stepReference'], ['blue', 'purple', 'orange', 'green', 'cyan', 'yellow']));
    // Register compile command
    const compileCommand = vscode.commands.registerCommand('ics.compile', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'ics') {
            vscode.window.showErrorMessage('Please open an ICS file to compile');
            return;
        }
        const compiler = new compiler_1.ICSCompiler();
        compiler.compile(editor.document);
    });
    const a1_compileCommand = vscode.commands.registerCommand('ics.compile_a1', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'ics') {
            vscode.window.showErrorMessage('Please open an ICS file to compile');
            return;
        }
        const compiler = new assignment_1_1.A1Compiler();
        compiler.compile(editor.document);
    });
    // Register validate command
    const validateCommand = vscode.commands.registerCommand('ics.validate', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'ics') {
            vscode.window.showErrorMessage('Please open an ICS file to validate');
            return;
        }
        const validator = new validator_1.ICSValidator();
        validator.validate(editor.document);
    });
    // Register diagnostic provider
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('ics');
    const validator = new validator_1.ICSValidator();
    // Validate on document change
    const validateDocument = (document) => {
        if (document.languageId === 'ics') {
            const diagnostics = validator.getDiagnostics(document);
            diagnosticCollection.set(document.uri, diagnostics);
        }
    };
    // Initial validation and setup watchers
    if (vscode.window.activeTextEditor) {
        validateDocument(vscode.window.activeTextEditor.document);
    }
    const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            validateDocument(editor.document);
        }
    });
    const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(event => {
        validateDocument(event.document);
    });
    context.subscriptions.push(completionProvider, hoverProvider, definitionProvider, semanticTokensProvider, compileCommand, validateCommand, diagnosticCollection, onDidChangeActiveTextEditor, onDidChangeTextDocument);
}
exports.activate = activate;
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
exports.deactivate = deactivate;
class ICSSemanticTokensProvider {
    provideDocumentSemanticTokens(document) {
        const tokensBuilder = new vscode.SemanticTokensBuilder();
        const content = document.getText();
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            // Check for section headers and apply appropriate colors
            if (trimmed.match(/^<<blueprint$/) || trimmed.match(/^blueprint>>$/)) {
                const startPos = line.indexOf('<<blueprint') !== -1 ? line.indexOf('<<blueprint') : line.indexOf('blueprint>>');
                tokensBuilder.push(i, startPos, trimmed.length, 0, 0); // blue
            }
            else if (trimmed.match(/^<<operational steps$/) || trimmed.match(/^operational steps>>$/)) {
                const startPos = line.indexOf('<<operational steps') !== -1 ? line.indexOf('<<operational steps') : line.indexOf('operational steps>>');
                tokensBuilder.push(i, startPos, trimmed.length, 0, 1); // purple
            }
            else if (trimmed.match(/^<<ocaml code$/) || trimmed.match(/^ocaml code>>$/)) {
                const startPos = line.indexOf('<<ocaml code') !== -1 ? line.indexOf('<<ocaml code') : line.indexOf('ocaml code>>');
                tokensBuilder.push(i, startPos, trimmed.length, 0, 2); // orange
            }
            else if (trimmed.match(/^<<(proof|induction|invariant)$/) || trimmed.match(/^(proof|induction|invariant)>>$/)) {
                const startPos = line.search(/<<(proof|induction|invariant)|((proof|induction|invariant)>>)/);
                if (startPos !== -1) {
                    tokensBuilder.push(i, startPos, trimmed.length, 0, 3); // green
                }
            }
            else if (trimmed.match(/^<<header$/) || trimmed.match(/^header>>$/)) {
                const startPos = line.indexOf('<<header') !== -1 ? line.indexOf('<<header') : line.indexOf('header>>');
                tokensBuilder.push(i, startPos, trimmed.length, 0, 4); // cyan
            }
            // Highlight step references outside of operational steps section
            if (!this.isInOperationalSteps(document, i)) {
                const stepReferences = line.match(/step \d+/g);
                if (stepReferences) {
                    stepReferences.forEach(stepRef => {
                        const startPos = line.indexOf(stepRef);
                        if (startPos !== -1) {
                            tokensBuilder.push(i, startPos, stepRef.length, 1, 5); // stepReference token type, yellow color
                        }
                    });
                }
            }
        }
        return tokensBuilder.build();
    }
    isInOperationalSteps(document, lineNumber) {
        let inOperationalSteps = false;
        for (let i = 0; i <= lineNumber; i++) {
            const line = document.lineAt(i).text.trim();
            if (line === '<<operational steps') {
                inOperationalSteps = true;
            }
            else if (line === 'operational steps>>') {
                inOperationalSteps = false;
            }
        }
        return inOperationalSteps;
    }
}
class ICSCompletionProvider {
    provideCompletionItems(document, position, token, context) {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        const completions = [];
        // Main section completions - changed to << syntax
        if (linePrefix.endsWith('<<')) {
            completions.push(this.createSectionCompletion('blueprint', 'Blueprint section with requires and ensures'), this.createSectionCompletion('operational steps', 'Operational steps section'), this.createSectionCompletion('ocaml code', 'OCaml code section'), this.createSectionCompletion('proof', 'Proof section'), this.createSectionCompletion('induction', 'Induction proof'), this.createSectionCompletion('invariant', 'Invariant proof'), this.createSectionCompletion('header', 'Header section with document metadata'));
        }
        // Enhanced step reference completions - trigger on "step" or "step "
        if (linePrefix.match(/step\s*$/i) || linePrefix.match(/step\s+\d*$/i)) {
            // Only provide step completions if we're NOT in operational steps section
            if (!this.isInOperationalSteps(document, position.line)) {
                const stepRefs = this.getStepReferences(document);
                stepRefs.forEach(step => {
                    const completion = new vscode.CompletionItem(`step ${step.number}`, vscode.CompletionItemKind.Reference);
                    completion.detail = `Reference to step ${step.number}`;
                    completion.documentation = new vscode.MarkdownString(`**Step ${step.number}**: ${step.text}`);
                    completion.insertText = `step ${step.number}`;
                    completion.sortText = `step_${step.number.toString().padStart(3, '0')}`; // Ensure proper sorting
                    // Add command to navigate to step definition
                    completion.command = {
                        command: 'vscode.open',
                        title: 'Go to step definition',
                        arguments: [document.uri, { selection: new vscode.Range(step.line, 0, step.line, step.text.length) }]
                    };
                    completions.push(completion);
                });
            }
        }
        // Header subsection completions
        const currentSection = this.getCurrentSection(document, position);
        if (currentSection === 'header') {
            completions.push(this.createSubsectionCompletion('assignment', 'Assignment details'), this.createSubsectionCompletion('student', 'Student name'), this.createSubsectionCompletion('date', 'Date of submission'), this.createSubsectionCompletion('collaborators', 'Collaborators (if any)'), this.createSubsectionCompletion('problem', 'Problem description'));
        }
        // Subsection completions based on context
        if (currentSection === 'blueprint') {
            completions.push(this.createSubsectionCompletion('requires', 'Requirements specification'), this.createSubsectionCompletion('ensures', 'Ensures specification'));
        }
        else if (currentSection === 'induction') {
            completions.push(this.createSubsectionCompletion('base case', 'Base case of induction'), this.createSubsectionCompletion('induction hypothesis', 'Induction hypothesis'), this.createSubsectionCompletion('inductive step', 'Inductive step'));
        }
        else if (currentSection === 'invariant') {
            completions.push(this.createSubsectionCompletion('pre-condition', 'Pre-condition'), this.createSubsectionCompletion('after the ith step', 'After the ith step'), this.createSubsectionCompletion('after the after the (i+1)th stepth step', 'After the after the (i+1)th stepth step'), this.createSubsectionCompletion('post-condition', 'Post-condition'));
        }
        return completions;
    }
    createSectionCompletion(section, description) {
        const completion = new vscode.CompletionItem(section, vscode.CompletionItemKind.Keyword);
        completion.detail = description;
        completion.insertText = new vscode.SnippetString(`${section}\n$0\n${section}>>`);
        return completion;
    }
    createSubsectionCompletion(subsection, description) {
        const completion = new vscode.CompletionItem(subsection, vscode.CompletionItemKind.Keyword);
        completion.detail = description;
        completion.insertText = new vscode.SnippetString(`${subsection}:\n$0`);
        return completion;
    }
    getCurrentSection(document, position) {
        for (let i = position.line; i >= 0; i--) {
            const line = document.lineAt(i).text.trim();
            const match = line.match(/^<<(blueprint|operational steps|ocaml code|proof|induction|invariant|header)$/);
            if (match) {
                return match[1];
            }
        }
        return null;
    }
    isInOperationalSteps(document, lineNumber) {
        let inOperationalSteps = false;
        for (let i = 0; i <= lineNumber; i++) {
            const line = document.lineAt(i).text.trim();
            if (line === '<<operational steps') {
                inOperationalSteps = true;
            }
            else if (line === 'operational steps>>') {
                inOperationalSteps = false;
            }
        }
        return inOperationalSteps;
    }
    getStepReferences(document) {
        const steps = [];
        let inOperationalSteps = false;
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text.trim();
            if (line === '<<operational steps') {
                inOperationalSteps = true;
                continue;
            }
            if (inOperationalSteps && line === 'operational steps>>') {
                inOperationalSteps = false;
                continue;
            }
            if (inOperationalSteps) {
                // Updated regex to handle both 'step n:' and 'n.' formats
                const stepMatch = line.match(/^\s*(?:step\s+)?(\d+)\s*[.:]?\s*(.+)$/i);
                if (stepMatch) {
                    steps.push({
                        number: parseInt(stepMatch[1]),
                        text: stepMatch[2],
                        line: i
                    });
                }
            }
        }
        return steps;
    }
}
class ICSHoverProvider {
    provideHover(document, position) {
        const range = document.getWordRangeAtPosition(position, /step \d+/);
        if (!range)
            return;
        const word = document.getText(range);
        const stepMatch = word.match(/step (\d+)/);
        if (!stepMatch)
            return;
        const stepNumber = parseInt(stepMatch[1]);
        const stepInfo = this.findStepInfo(document, stepNumber);
        if (stepInfo) {
            const markdown = new vscode.MarkdownString();
            markdown.appendMarkdown(`**Step ${stepNumber}**: ${stepInfo.text}`);
            markdown.appendMarkdown(`\n\n*Click to go to definition*`);
            return new vscode.Hover(markdown, range);
        }
    }
    findStepInfo(document, stepNumber) {
        let inOperationalSteps = false;
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text.trim();
            if (line === '<<operational steps') {
                inOperationalSteps = true;
                continue;
            }
            if (inOperationalSteps && line === 'operational steps>>') {
                break;
            }
            if (inOperationalSteps) {
                const stepMatch = line.match(/^\s*(?:step\s+)?(\d+)\s*[.:]?\s*(.+)$/i);
                if (stepMatch && parseInt(stepMatch[1]) === stepNumber) {
                    return { text: stepMatch[2], line: i };
                }
            }
        }
        return null;
    }
}
class ICSDefinitionProvider {
    provideDefinition(document, position) {
        const range = document.getWordRangeAtPosition(position, /step \d+/);
        if (!range)
            return;
        const word = document.getText(range);
        const stepMatch = word.match(/step (\d+)/);
        if (!stepMatch)
            return;
        const stepNumber = parseInt(stepMatch[1]);
        const stepInfo = this.findStepDefinition(document, stepNumber);
        if (stepInfo) {
            return new vscode.Location(document.uri, new vscode.Position(stepInfo.line, 0));
        }
    }
    findStepDefinition(document, stepNumber) {
        let inOperationalSteps = false;
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text.trim();
            if (line === '<<operational steps') {
                inOperationalSteps = true;
                continue;
            }
            if (inOperationalSteps && line === 'operational steps>>') {
                break;
            }
            if (inOperationalSteps) {
                const stepMatch = line.match(/^\s*(?:step\s+)?(\d+)\s*[.:]?\s*(.+)$/i);
                if (stepMatch && parseInt(stepMatch[1]) === stepNumber) {
                    return { line: i };
                }
            }
        }
        return null;
    }
}
//# sourceMappingURL=extension.js.map