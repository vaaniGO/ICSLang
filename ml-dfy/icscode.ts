// define global immutable values here - only regex matches 

export interface CodeComponents {
    ocamlCode: string[]; // every code component has an ocaml code representation that is given to it
    
    constructor() : void; // default constructor 
    constructor(input: string[]) : void; // paramterized constructor
    isValid() : boolean; // checks for the validity of the code component, though this might be redundant if we are parsing anyways
    toDafny(): string; // every code component has a dafny representation
}

