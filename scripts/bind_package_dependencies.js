/**
 * @license
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import _ from 'lodash';

function bindPackageDependencies() {
  const scriptDir = process.cwd();
  const currentPkgJsonPath = path.join(scriptDir, 'package.json');
  const currentPkg = JSON.parse(fs.readFileSync(currentPkgJsonPath));
  // assume packages are all under /<repo_root>/packages/
  const packagesDir = path.join(path.dirname(scriptDir));

  const grokCliPkgs = fs
    .readdirSync(packagesDir)
    .filter(
      (name) =>
        fs.statSync(path.join(packagesDir, name)).isDirectory() &&
        fs.existsSync(path.join(packagesDir, name, 'package.json')),
    )
    .map((packageDirname) => {
      const packageJsonPath = path.join(
        packagesDir,
        packageDirname,
        'package.json',
      );
      return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    })
    .reduce((pkgs, pkg) => ({ ...pkgs, [pkg.name]: pkg }), {});
  currentPkg.dependencies = _.mapValues(
    currentPkg.dependencies,
    (value, key) => {
      if (grokCliPkgs[key]) {
        console.log(
          `Package ${currentPkg.name} has a dependency on ${key}. Updating dependent version.`,
        );
        return grokCliPkgs[key].version;
      }
      return value;
    },
  );
  const updatedPkgJson = JSON.stringify(currentPkg, null, 2) + '\n';
  fs.writeFileSync(currentPkgJsonPath, updatedPkgJson);
}

bindPackageDependencies();
