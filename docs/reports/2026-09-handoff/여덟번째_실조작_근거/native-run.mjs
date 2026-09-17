const result = await fetch('http://127.0.0.1:4410/run', { method: 'POST', body: JSON.stringify({ file: process.argv[2] }) });
console.log(await result.text());
if (!result.ok) process.exitCode = 1;
