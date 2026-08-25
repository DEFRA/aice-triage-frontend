// @vitest-environment jsdom

import { initSelectAllCheckboxes } from '../../../../src/client/javascripts/select-all-checkboxes.js'

describe('#initSelectAllCheckboxes', () => {
  function buildDom () {
    document.body.innerHTML = `
      <input type="checkbox" data-select-all="submissionIds" />
      <input type="checkbox" name="submissionIds" value="SUB-1" />
      <input type="checkbox" name="submissionIds" value="SUB-2" />
      <input type="checkbox" name="unrelated" value="SUB-3" />
    `

    return {
      selectAll: document.querySelector('[data-select-all]'),
      targets: [...document.querySelectorAll('input[name="submissionIds"]')],
      unrelated: document.querySelector('input[name="unrelated"]')
    }
  }

  function fireChange (element) {
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('checking select-all ticks every matching checkbox', () => {
    const { selectAll, targets } = buildDom()
    initSelectAllCheckboxes()

    selectAll.checked = true
    fireChange(selectAll)

    expect(targets.every((checkbox) => checkbox.checked)).toBe(true)
  })

  test('unchecking select-all unticks every matching checkbox', () => {
    const { selectAll, targets } = buildDom()
    initSelectAllCheckboxes()

    selectAll.checked = true
    fireChange(selectAll)
    selectAll.checked = false
    fireChange(selectAll)

    expect(targets.some((checkbox) => checkbox.checked)).toBe(false)
  })

  test('select-all does not affect checkboxes with a different name', () => {
    const { selectAll, unrelated } = buildDom()
    initSelectAllCheckboxes()

    selectAll.checked = true
    fireChange(selectAll)

    expect(unrelated.checked).toBe(false)
  })

  test('select-all becomes checked once every matching checkbox is manually ticked', () => {
    const { selectAll, targets } = buildDom()
    initSelectAllCheckboxes()

    targets.forEach((checkbox) => {
      checkbox.checked = true
      fireChange(checkbox)
    })

    expect(selectAll.checked).toBe(true)
  })

  test('select-all becomes unchecked if any matching checkbox is manually unticked', () => {
    const { selectAll, targets } = buildDom()
    initSelectAllCheckboxes()

    targets.forEach((checkbox) => {
      checkbox.checked = true
      fireChange(checkbox)
    })

    targets[0].checked = false
    fireChange(targets[0])

    expect(selectAll.checked).toBe(false)
  })

  test('does nothing when there is no select-all control on the page', () => {
    document.body.innerHTML = '<input type="checkbox" name="submissionIds" />'

    expect(() => initSelectAllCheckboxes()).not.toThrow()
  })
})
