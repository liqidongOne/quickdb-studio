name: Pull Request
description: Submit changes to quickdb-studio
body:
  - type: markdown
    attributes:
      text: |
        Thanks for submitting a PR!

  - type: textarea
    id: description
    attributes:
      label: Description
      description: What does this PR change and why?
      placeholder: A brief summary of your changes
    validations:
      required: true

  - type: textarea
    id: testing
    attributes:
      label: Testing
      description: How was this tested?
      placeholder: Describe the tests you ran or manual verification steps
    validations:
      required: false

  - type: checkboxes
    id: checklist
    attributes:
      label: Checklist
      options:
        - label: My code follows the existing code style
          required: true
        - label: Tests pass locally (`go test ./...` and `cd webui && npm run build`)
          required: true
        - label: I have read the CONTRIBUTING guidelines
          required: true
