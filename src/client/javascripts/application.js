import * as govukFrontend from 'govuk-frontend'

govukFrontend.initAll()

function initSelectAllCheckboxes () {
  document.querySelectorAll('[data-select-all]').forEach((selectAll) => {
    const targetName = selectAll.dataset.selectAll
    const getTargets = () =>
      document.querySelectorAll(`input[type="checkbox"][name="${targetName}"]`)

    selectAll.addEventListener('change', () => {
      getTargets().forEach((checkbox) => {
        checkbox.checked = selectAll.checked
      })
    })

    document.addEventListener('change', (event) => {
      if (event.target.matches(`input[type="checkbox"][name="${targetName}"]`)) {
        const targets = [...getTargets()]

        selectAll.checked =
          targets.length > 0 && targets.every((checkbox) => checkbox.checked)
      }
    })
  })
}

initSelectAllCheckboxes()
