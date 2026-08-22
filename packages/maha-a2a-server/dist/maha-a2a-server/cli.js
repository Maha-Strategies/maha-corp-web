#!/usr/bin/env node
/**
 * `maha-a2a-server` — A2A over loopback HTTP.
 *
 * Binds 127.0.0.1 unless told otherwise, and being told otherwise takes an
 * explicit flag, so exposure is never something that happens by default.
 */
import { A2A_CARD_PATH, A2A_TASKS_PATH, startMahaA2AServer } from "./index.js";
const argv = process.argv.slice(2);
const flag = (name) => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && index + 1 < argv.length ? argv[index + 1] : undefined;
};
if (argv.includes('--help') || argv.includes('-h')) {
    process.stderr.write([
        'maha-a2a-server — Maha Context Control over A2A on loopback HTTP.',
        '',
        '  --port <n>            port to bind (default: an ephemeral port)',
        '  --host <addr>         address to bind (default: 127.0.0.1)',
        '  --allow-non-loopback  required to bind anything but loopback',
        '  --help                this text',
        '',
        'Reads no credentials and refuses any passed as arguments. Makes no',
        'outbound calls of any kind.',
        '',
    ].join('\n'));
    process.exit(0);
}
const credentialLike = argv.find((argument) => /secret|token|credential|password|api[-_]?key|authorization/i.test(argument));
if (credentialLike) {
    process.stderr.write('Refusing to start: this server never takes credentials as arguments. Use the environment.\n');
    process.exit(2);
}
const portArgument = flag('port');
const port = portArgument === undefined ? 0 : Number(portArgument);
if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    process.stderr.write(`Refusing to start: --port ${portArgument} is not a valid port.\n`);
    process.exit(2);
}
try {
    const started = await startMahaA2AServer({
        port,
        host: flag('host') ?? '127.0.0.1',
        allowNonLoopback: argv.includes('--allow-non-loopback'),
    });
    process.stderr.write(`maha-a2a-server listening on ${started.baseUrl}\n  card: ${started.baseUrl}${A2A_CARD_PATH}\n  tasks: POST ${started.baseUrl}${A2A_TASKS_PATH}\n`);
    // stdout carries one machine-readable line so a harness can find the port
    // without scraping human text.
    process.stdout.write(`${JSON.stringify({ baseUrl: started.baseUrl, port: started.port, cardPath: A2A_CARD_PATH, tasksPath: A2A_TASKS_PATH })}\n`);
}
catch (caught) {
    process.stderr.write(`${caught instanceof Error ? caught.message : String(caught)}\n`);
    process.exit(2);
}
//# sourceMappingURL=cli.js.map