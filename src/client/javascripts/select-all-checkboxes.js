function initSelectAllCheckboxes (root = document) {
  root.querySelectorAll('[data-select-all]').forEach((selectAll) => {
    const targetName = selectAll.dataset.selectAll
    const getTargets = () =>
      root.querySelectorAll(`input[type="checkbox"][name="${targetName}"]`)

    selectAll.addEventListener('change', () => {
      getTargets().forEach((checkbox) => {
        checkbox.checked = selectAll.checked
      })
    })

    root.addEventListener('change', (event) => {
      if (event.target.matches(`input[type="checkbox"][name="${targetName}"]`)) {
        const targets = [...getTargets()]

        selectAll.checked =
          targets.length > 0 && targets.every((checkbox) => checkbox.checked)
      }
    })
  })
}

export { initSelectAllCheckboxes }
