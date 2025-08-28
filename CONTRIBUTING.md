# Contributing to Discord Bot Starter Project

Thank you for your interest in contributing to this Discord bot starter project! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

### Reporting Issues

1. **Check existing issues** first to avoid duplicates
2. **Use the issue template** if available
3. **Provide detailed information** including:
   - Bot version
   - Node.js version
   - Operating system
   - Steps to reproduce
   - Expected vs actual behavior
   - Error messages or logs

### Suggesting Features

1. **Open an issue** with the "feature request" label
2. **Describe the feature** in detail
3. **Explain the use case** and benefits
4. **Consider implementation impact** on existing code

### Code Contributions

1. **Fork the repository**
2. **Create a feature branch** from `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** following the coding standards
4. **Write or update tests** if applicable
5. **Update documentation** as needed
6. **Run linting and tests**
   ```bash
   npm run lint
   npm run format
   ```
7. **Commit your changes** with clear messages
8. **Push to your fork** and create a pull request

## 📝 Coding Standards

### TypeScript Guidelines

- Use **strict TypeScript** with proper type annotations
- Prefer **interfaces over types** for object definitions
- Use **meaningful variable and function names**
- Add **JSDoc comments** for public methods
- Follow **camelCase** for variables and functions
- Follow **PascalCase** for classes and interfaces

### Code Style

- Use **2 spaces** for indentation
- Use **single quotes** for strings
- Add **trailing commas** in arrays and objects
- Keep **line length under 80 characters** when reasonable
- Use **async/await** instead of promises chains

### Architecture Patterns

- Follow **singleton pattern** for services
- Use **dependency injection** where appropriate
- Implement **proper error handling** with try-catch blocks
- Use **logger service** instead of console.log
- Follow **separation of concerns** principle

### Database Guidelines

- Use **migrations** for schema changes
- Write **reversible migrations** with up/down methods
- Use **repository pattern** for data access
- Validate **input data** before database operations
- Use **transactions** for multiple related operations

### Command Development

```typescript
// Good example
export const exampleCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('example')
    .setDescription('A well-documented example command')
    .addStringOption(option =>
      option.setName('input')
        .setDescription('Example input parameter')
        .setRequired(true)
    ),

  async execute(interaction: CommandInteraction): Promise<void> {
    try {
      const input = interaction.options.getString('input', true);
      
      // Validate input
      if (!isValidInput(input)) {
        await interaction.reply({
          content: '❌ Invalid input provided.',
          ephemeral: true,
        });
        return;
      }

      // Process command
      const result = await processInput(input);

      // Send response
      await interaction.reply({
        content: `✅ Result: ${result}`,
      });

      // Log command execution
      logger.logCommand(
        interaction.commandName,
        interaction.user.id,
        interaction.guildId || undefined
      );

    } catch (error) {
      logger.error(`Error in ${interaction.commandName} command`, error);
      
      const errorMessage = '❌ An error occurred while executing this command.';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },
};
```

## 🧪 Testing Guidelines

### Manual Testing

1. **Test in development environment** first
2. **Use a test Discord server** for validation
3. **Test edge cases** and error conditions
4. **Verify permissions** and role hierarchy
5. **Test with different user types** (admin, member, bot)

### Code Quality Checks

```bash
# Run all quality checks
npm run lint          # Check for linting errors
npm run lint:fix      # Auto-fix linting issues
npm run format        # Format code with Prettier
npm run build         # Ensure TypeScript compiles
```

## 📚 Documentation Standards

### Code Documentation

- Add **JSDoc comments** for all public methods
- Include **parameter descriptions** and return types
- Document **complex logic** with inline comments
- Use **clear variable names** that don't need comments

### README Updates

- Update **feature lists** when adding new functionality
- Add **new commands** to the commands section
- Update **installation steps** if dependencies change
- Include **examples** for new features

### Changelog

- Follow **Keep a Changelog** format
- Use **semantic versioning** for releases
- Group changes by **Added, Changed, Deprecated, Removed, Fixed, Security**
- Include **dates** for all releases

## 🔄 Pull Request Process

### Before Submitting

1. **Rebase your branch** on the latest main
2. **Run all quality checks** locally
3. **Test your changes** thoroughly
4. **Update documentation** as needed
5. **Write clear commit messages**

### PR Requirements

- **Clear title** describing the change
- **Detailed description** of what was changed and why
- **Link to related issues** if applicable
- **Screenshots** for UI changes
- **Breaking changes** clearly marked

### Review Process

1. **Automated checks** must pass
2. **Code review** by maintainers
3. **Testing** in development environment
4. **Documentation review** if applicable
5. **Final approval** before merge

## 🐛 Bug Fix Guidelines

### Identifying Bugs

1. **Reproduce the issue** consistently
2. **Identify root cause** through debugging
3. **Consider edge cases** that might be affected
4. **Check for similar issues** elsewhere

### Fixing Process

1. **Write a test** that reproduces the bug
2. **Implement the fix** with minimal changes
3. **Verify the test passes** with the fix
4. **Test related functionality** for regressions
5. **Update documentation** if behavior changes

## 🚀 Feature Development

### Planning

1. **Discuss the feature** in an issue first
2. **Consider backwards compatibility**
3. **Plan the API design** carefully
4. **Identify integration points**

### Implementation

1. **Start with interfaces** and type definitions
2. **Implement core functionality** first
3. **Add error handling** and validation
4. **Write comprehensive tests**
5. **Add logging** and monitoring

### Documentation

1. **Update README** with new features
2. **Add code examples** for usage
3. **Document configuration** options
4. **Update changelog** with changes

## 📋 Commit Message Guidelines

Use the conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

### Examples

```
feat(commands): add timeout command for temporary bans

Add a new /timeout command that allows moderators to temporarily
restrict a user's ability to send messages.

Closes #123
```

```
fix(database): resolve connection pool exhaustion

Fix issue where database connections weren't being properly released
after failed transactions, leading to pool exhaustion.

Fixes #456
```

## 🤖 Bot-Specific Guidelines

### Discord API Best Practices

- **Respect rate limits** in all implementations
- **Handle API errors** gracefully
- **Use appropriate intents** only
- **Validate permissions** before actions
- **Cache data** when appropriate

### Security Considerations

- **Validate all user input**
- **Use parameterized queries** for database operations
- **Don't log sensitive information**
- **Implement proper permission checks**
- **Sanitize user-generated content**

### Performance Guidelines

- **Use database indexes** for frequently queried fields
- **Implement pagination** for large data sets
- **Cache frequently accessed data**
- **Optimize database queries**
- **Use batch operations** when possible

## 📞 Getting Help

- **Discord Server**: [Your Discord Server Link]
- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Documentation**: Check README and code comments first

## 🎉 Recognition

Contributors will be recognized in:

- **README.md** contributors section
- **GitHub releases** changelog
- **Project documentation**

Thank you for contributing to making this Discord bot starter project better! 🚀