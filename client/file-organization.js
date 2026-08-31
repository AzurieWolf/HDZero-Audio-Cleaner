const fs = require('fs');
const path = require('path');

function uniquePathIn(directory, parsed) {
  let candidate = path.join(directory, `${parsed.name}${parsed.ext}`);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${parsed.name}-${index}${parsed.ext}`);
    index += 1;
  }
  return candidate;
}

async function moveOriginalVideo(input) {
  const parsed = path.parse(input);
  if (path.basename(parsed.dir).toLowerCase() === 'original') return input;

  const directory = path.join(parsed.dir, 'Original');
  await fs.promises.mkdir(directory, { recursive: true });
  const destination = uniquePathIn(directory, parsed);
  await fs.promises.rename(input, destination);
  return destination;
}

module.exports = { moveOriginalVideo };
