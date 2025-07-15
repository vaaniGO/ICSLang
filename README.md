ICS Language Support Extension
A VS Code extension that provides comprehensive language support for ICS (Integrated Computer Science) format files, including syntax highlighting, auto-completion, validation, and HTML compilation.

Features
🎯 Auto-completion
Smart completion for ICS keywords and sections
Automatic closing tag insertion (e.g., typing \proof auto-completes to \proof ... \proof)
Context-aware subsection suggestions
Step reference completion with navigation
📝 Syntax Highlighting
Custom syntax highlighting for ICS sections
OCaml code highlighting within \ocaml code sections
Special highlighting for step references and keywords
✅ Validation & Diagnostics
Real-time validation of ICS document structure
Ensures all required subsections are present
Validates that all opened sections are properly closed
Warns about invalid step references
🔧 Compilation
Compiles ICS files to structured HTML with custom CSS
Generates beautiful, printable documents
Includes step reference linking and navigation
Responsive design for different screen sizes
🔍 Navigation
Go-to-definition for step references
Hover information for steps
Quick navigation between sections
Installation
Clone this repository
Open in VS Code
Run npm install to install dependencies
Press F5 to launch the extension in a new Extension Development Host window
Usage
Creating an ICS Document
Create a new file with the .ics extension and start typing. The extension will provide auto-completion for all ICS keywords.

Main Sections
The ICS format supports four main sections:

Blueprint (\blueprint ... \blueprint)
Must contain requires: and ensures: subsections
Operational Steps (\operational steps ... \operational steps)
Contains numbered steps (1., 2., 3., etc.)
Steps can be referenced elsewhere in the document
OCaml Code (\ocaml code ... \ocaml code)
Contains OCaml implementation with syntax highlighting
Proof (\proof ... \proof)
Can contain either induction or invariant proofs
Induction: requires base case:, induction hypothesis:, inductive step:
Invariant: requires pre-condition:, after the ith step:, after the (i+1)th step:, post-condition:
Step References
In the operational steps section, define steps like:

\operational steps
1. Initialize variables
2. Check condition
3. Process result
\operational steps
Anywhere else in the document, you can reference these steps by typing step 1, step 2, etc. The extension will:

Provide auto-completion for available steps
Show hover information
Allow click-to-navigate to step definition
Commands
Compile ICS (Ctrl+Shift+C): Compiles the current ICS file to HTML
Validate ICS: Validates the current document structure
Configuration
You can configure the extension through VS Code settings:

ics.outputPath: Output directory for compiled HTML files (default: ./output)
ics.enableAutoCompletion: Enable/disable auto-completion features (default: true)
Example
See example.ics for a complete example of an ICS document demonstrating all features.

Development
File Structure
├── src/
│   ├── extension.ts     # Main extension file
│   ├── compiler.ts      # ICS to HTML compiler
│   └── validator.ts     # Document validation
├── syntaxes/
│   └── ics.tmLanguage.json  # Syntax grammar
├── language-configuration.json  # Language configuration
└── package.json         # Extension manifest
Building
bash
npm run compile
Testing
bash
npm run test
Contributing
Fork the repository
Create a feature branch
Make your changes
Add tests if applicable
Submit a pull request
License
MIT License - see LICENSE file for details.

Changelog
0.0.1
Initial release
Basic syntax highlighting
Auto-completion for keywords
Document validation
HTML compilation
Step reference navigation
