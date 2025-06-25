/**
 * Custom Vue directive v-hide
 *
 * Usage: v-hide="boolean"
 *
 * Toggles the 'visibility: hidden' style on an element.
 * The element remains in the DOM and occupies its space, preventing layout shifts.
 *
 * @param {HTMLElement} el - The element the directive is bound to.
 * @param {object} binding - The binding object, binding.value contains the directive's value.
 */
const setVisibility = (el, binding) => {
  // We expect a boolean value. If true, we hide the element.
  el.style.visibility = binding.value ? 'hidden' : 'visible'
}

export const vHide = {
  // Called when the bound element is first mounted to the DOM.
  mounted: setVisibility,

  // Called when the component holding the element is updated.
  updated: setVisibility,
}
