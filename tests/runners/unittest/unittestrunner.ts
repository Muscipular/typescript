///<reference path="../../../src/harness/harness.ts" />
///<reference path="../runnerbase.ts" />

enum UnittestTestType {
    Compiler,
    LanguageService,
    Services,
    Harness,
    Samples
}

class UnitTestRunner extends RunnerBase {
    constructor(public testType?: UnittestTestType) {
        super();
    }

    public initializeTests() {
        switch (this.testType) {
            case UnittestTestType.Compiler:
                this.tests = this.enumerateFiles('tests/cases/unittests/compiler');
                break;
            case UnittestTestType.LanguageService:
                this.tests = this.enumerateFiles('tests/cases/unittests/ls');
                break;
            case UnittestTestType.Harness:
                this.tests = this.enumerateFiles('tests/cases/unittests/harness');
                break;
            case UnittestTestType.Samples:
                this.tests = this.enumerateFiles('tests/cases/unittests/samples');
                break;
            default:
                if (this.tests.length === 0) {
                    throw new Error('Unsupported test cases: ' + this.testType);
                }
                break;
        }

        var outfile = new Harness.Compiler.WriterAggregator()
        var outerr = new Harness.Compiler.WriterAggregator();
        // note this is running immediately to generate tests to be run later inside describe/it
        // need a fresh instance so that the previous runner's last test is not hanging around
        var harnessCompiler = Harness.Compiler.getCompiler({ useExistingInstance: false });

        var toBeAdded = this.tests.map(test => {
            return { unitName: test, content: Harness.Environment.readFile(test, /*codepage:*/ null).contents }
        });
        harnessCompiler.addInputFiles(toBeAdded);
        harnessCompiler.compile({ noResolve: true });
        
        var stdout = new Harness.Compiler.EmitterIOHost();
        var emitDiagnostics = harnessCompiler.emitAll(stdout);
        var results = stdout.toArray();
        var lines: string[] = [];
        results.forEach(v => lines = lines.concat(v.file.lines));
        var code = lines.join("\n")

        var nodeContext: any = undefined;
        if (Harness.currentExecutionEnvironment == Harness.ExecutionEnvironment.Node) {
            nodeContext = {
                require: require,
                TypeScript: TypeScript,
                process: process,
                describe: describe,
                it: it,
                assert: assert,
                beforeEach: beforeEach,
                afterEach: afterEach,
                before: before,
                after: after,
                Harness: Harness,
                IO: Harness.Environment,
                Exec: Exec,
                Services: TypeScript.Services,
                FourSlash: FourSlash
            };
        }

        describe("Setup compiler for compiler unittests", () => {
            // ensures a clean compiler instance when tests are eventually executed following this describe block
            harnessCompiler = Harness.Compiler.getCompiler({
                useExistingInstance: false,
                optionsForFreshInstance: { useMinimalDefaultLib: this.testType !== UnittestTestType.Samples, noImplicitAny: false }
            });
        });

        // this generated code is a series of top level describe/it blocks that will run in between the setup and cleanup blocks in this file
        Utils.evalFile(code, "generated_test_code.js", nodeContext);

        describe("Cleanup after unittests", () => {
            var harnessCompiler = Harness.Compiler.getCompiler({
                useExistingInstance: false,
                optionsForFreshInstance: { useMinimalDefaultLib: true, noImplicitAny: false }
            });
        });

        // note this runs immediately (ie before this same code in the describe block above)
        // to make sure the next runner doesn't include the previous one's stuff
        harnessCompiler = Harness.Compiler.getCompiler({ useExistingInstance: false });
    }
}