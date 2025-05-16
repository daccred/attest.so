## Build and Publish SDK

### 1. Build the SDK

Run the following command to generate the `dist` folder:

```bash
npm run build
```

### 2. Create an NPM Account

If you don’t have an NPM account, [create one here](https://www.npmjs.com/signup).

### 3. Log in to NPM

Log in from the command line in your project directory:

```bash
npm login
```

### 4. Test Locally (Optional)

If needed, test your package locally using:

```bash
npm link
```

_Skipping this step here as everything appears to be working._

### 5. Initialize NPM Scope

Initialize with a scope

```bash
npm init --scope=<preferred_name>
```

### 6. Publish the Package

Publish the package to the NPM registry:

```bash
npm publish --access=public
```
