export {}

function findValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  return args[index + 1]
}

function readText(): Promise<string> {
  return new Promise((resolve) => {
    const list: Buffer[] = []
    process.stdin.on('data', (chunk) => list.push(chunk as Buffer))
    process.stdin.on('end', () => resolve(Buffer.concat(list).toString('utf8')))
    process.stdin.resume()
  })
}

function parseJson(text: string): unknown {
  const value = text.trim()
  if (!value) return null
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const json = findValue(args, '--json')
  const inputText = json ?? (await readText())

  const inputData = parseJson(inputText)

  const output = {
    name: 'echo',
    time: Date.now(),
    input: inputData,
  }

  process.stdout.write(JSON.stringify(output) + '\n')
}

await main()
