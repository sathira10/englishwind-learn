# PortalShot

A screenshot of the learning portal inside a plain browser frame: a `surface` top bar holding the portal's host (read from `site.courseUrl`) in `fg-muted` on a `bg` field. No border and no window dots; the bar and the page below it step apart in tone. The image is 16:10, cropped from the top.

No props: the image comes from `site.images.portalScreenshot`. While it is null the frame keeps its footprint over an empty `surface-dark-alt` field, hidden from assistive technology, and the caption is omitted so the empty frame makes no claim. The current image is `public/img/portal.webp`, 1216x760, cropped from the top of the lesson index; a replacement keeps the 16:10 ratio and the width and height in the component.
