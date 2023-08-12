import minimist from "minimist";

/**
 * @typedef {Object} Preset
 * @property {Object} [tsc]
 * @property {string[]} tsc.hosts
 * @property {number} tsc.iterations
 * @property {string[]} tsc.scenarios
 * @property {Object} [tsserver]
 * @property {string[]} tsserver.hosts
 * @property {number} tsserver.iterations
 * @property {string[]} tsserver.scenarios
 * @property {Object} [startup]
 * @property {string[]} startup.hosts
 * @property {number} startup.iterations
 * @property {string[]} startup.scenarios
 */
void 0;

const defaultIterations = 6;

// This version is arbitrary (just what was latest on 2023-08-12).
const node20 = "node@20.5.1";
// These two versions match those found in recent VS Code versions via Electron.
const node18 = "node@18.15.0";
const node16 = "node@16.17.1";

const allTscScenarios = ["Angular", "Monaco", "TFS", "material-ui", "Compiler-Unions", "xstate"];
const allTsserverScenarios = ["Compiler-UnionsTSServer", "CompilerTSServer", "xstateTSServer"];
const allStartupScenarios = ["tsc-startup", "tsserver-startup", "tsserverlibrary-startup", "typescript-startup"];

// Note: keep this up to date with TSPERF_PRESET.
/** @type {Record<string, Preset | undefined>} */
const presets = {
    "full": {
        tsc: {
            hosts: [node20, node18, node16],
            iterations: defaultIterations,
            scenarios: allTscScenarios,
        },
        tsserver: {
            hosts: [node16],
            iterations: defaultIterations,
            scenarios: allTsserverScenarios,
        },
        startup: {
            hosts: [node16],
            iterations: defaultIterations,
            scenarios: allStartupScenarios,
        },
    },
    "regular": {
        tsc: {
            hosts: [node16],
            iterations: defaultIterations,
            scenarios: allTscScenarios,
        },
        tsserver: {
            hosts: [node16],
            iterations: defaultIterations,
            scenarios: allTsserverScenarios,
        },
        startup: {
            hosts: [node16],
            iterations: defaultIterations,
            scenarios: allStartupScenarios,
        },
    },
    "tsc-only": {
        tsc: {
            hosts: [node16],
            iterations: defaultIterations,
            scenarios: allTscScenarios,
        },
    },
};

const args = minimist(process.argv.slice(2), {
    string: ["preset"],
});

const presetArg = args.preset;
const baselining = (process.env.USE_BASELINE_MACHINE || "FALSE").toUpperCase() === "TRUE";

const preset = presets[presetArg];
if (!preset) {
    // TODO: if "custom", build a custom matrix from arguments
    console.error(`Unknown preset: ${presetArg}`);
    process.exit(1);
}

/**
 * @param {string} name
 */
function sanitizeJobName(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

/** @type {Record<string, Record<string, string | number | boolean | undefined>>} */
const matrix = {};

let mergeTsc = false;
let mergeTsserver = false;
let mergeStarup = false;

if (baselining) {
    // If we're baselining, it'll be much faster to run all benchmarks in one job.
    if (preset.tsc) {
        mergeTsc = true;
    }
    if (preset.tsserver) {
        mergeTsserver = true;
    }
    if (preset.startup) {
        mergeStarup = true;
    }

    matrix["all"] = {
        TSPERF_JOB_NAME: "all",
        TSPERF_TSC: !!preset.tsc?.iterations,
        TSPERF_TSC_HOSTS: preset.tsc?.hosts.join(","),
        TSPERF_TSC_SCENARIOS: preset.tsc?.scenarios.join(","),
        TSPERF_TSC_ITERATIONS: preset.tsc?.iterations,
        TSPERF_TSSERVER: !!preset.tsserver?.iterations,
        TSPERF_TSSERVER_HOSTS: preset.tsserver?.hosts.join(","),
        TSPERF_TSSERVER_SCENARIOS: preset.tsserver?.scenarios.join(","),
        TSPERF_TSSERVER_ITERATIONS: preset.tsserver?.iterations,
        TSPERF_STARTUP: !!preset.startup?.iterations,
        TSPERF_STARTUP_HOSTS: preset.startup?.hosts.join(","),
        TSPERF_STARTUP_SCENARIOS: preset.startup?.scenarios.join(","),
        TSPERF_STARTUP_ITERATIONS: preset.startup?.iterations,
    };
}
else {
    // If we're not baselining, it should end up faster to run on as many machines as possible.
    if (preset.tsc) {
        for (const host of preset.tsc.hosts) {
            for (const scenario of preset.tsc.scenarios) {
                mergeTsc = true;
                const jobName = sanitizeJobName(`tsc_${host}_${scenario}`);
                matrix[jobName] = {
                    TSPERF_JOB_NAME: jobName,
                    TSPERF_TSC: true,
                    TSPERF_TSC_HOSTS: host,
                    TSPERF_TSC_SCENARIOS: scenario,
                    TSPERF_TSC_ITERATIONS: preset.tsc.iterations,
                };
            }
        }
    }

    if (preset.tsserver) {
        for (const host of preset.tsserver.hosts) {
            for (const scenario of preset.tsserver.scenarios) {
                mergeTsserver = true;
                const jobName = sanitizeJobName(`tsserver_${host}_${scenario}`);
                matrix[jobName] = {
                    TSPERF_JOB_NAME: jobName,
                    TSPERF_TSSERVER: true,
                    TSPERF_TSSERVER_HOSTS: host,
                    TSPERF_TSSERVER_SCENARIOS: scenario,
                    TSPERF_TSSERVER_ITERATIONS: preset.tsserver.iterations,
                };
            }
        }
    }

    if (preset.startup) {
        for (const host of preset.startup.hosts) {
            for (const scenario of preset.startup.scenarios) {
                mergeStarup = true;
                const jobName = sanitizeJobName(`startup_${host}_${scenario}`);
                matrix[jobName] = {
                    TSPERF_JOB_NAME: jobName,
                    TSPERF_STARTUP: true,
                    TSPERF_STARTUP_HOSTS: host,
                    TSPERF_STARTUP_SCENARIOS: scenario,
                    TSPERF_STARTUP_ITERATIONS: preset.startup.iterations,
                };
            }
        }
    }
}

console.log(JSON.stringify(matrix, undefined, 4));
console.log(`##vso[task.setvariable variable=MATRIX;isOutput=true]${JSON.stringify(matrix)}`);

console.log(`##vso[task.setvariable variable=TSPERF_MERGE_TSC;isOutput=true]${mergeTsc}`);
console.log(`##vso[task.setvariable variable=TSPERF_MERGE_TSSERVER;isOutput=true]${mergeTsserver}`);
console.log(`##vso[task.setvariable variable=TSPERF_MERGE_STARTUP;isOutput=true]${mergeStarup}`);
