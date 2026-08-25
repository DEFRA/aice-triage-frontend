// @vitest-environment jsdom

describe('#application entry point', () => {
  test('initialises without throwing', async () => {
    document.body.innerHTML = `
      <input type="checkbox" data-select-all="submissionIds" />
      <input type="checkbox" name="submissionIds" value="SUB-1" />
    `

    await expect(
      import('../../../../src/client/javascripts/application.js')
    ).resolves.not.toThrow()
  })
})
