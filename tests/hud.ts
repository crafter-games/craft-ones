import { expect, type Page } from "@playwright/test";

export const hudViewports = [
  { width: 1440, height: 460 },
  { width: 1280, height: 600 },
  { width: 800, height: 450 },
  { width: 640, height: 360 },
  { width: 390, height: 700 },
];

export async function expectHudToFit(page: Page) {
  await expect
    .poll(() =>
      page.locator(".hud").evaluate((hud) => {
        const bounds = hud.getBoundingClientRect();
        const groups = [
          ...hud.querySelectorAll<HTMLElement>(
            ".hud-card, .hud-clock, .hud-status, .hud-utilities, .hud-movement, .hud-hotbar, .hud-power",
          ),
        ];
        const issues: string[] = [];
        for (const [index, group] of groups.entries()) {
          const box = group.getBoundingClientRect();
          if (
            box.left < bounds.left ||
            box.right > bounds.right + 1 ||
            box.top < bounds.top ||
            box.bottom > bounds.bottom + 1
          )
            issues.push(`${group.className} leaves the container`);
          for (const other of groups.slice(index + 1)) {
            const next = other.getBoundingClientRect();
            if (
              Math.min(box.right, next.right) - Math.max(box.left, next.left) >
                1 &&
              Math.min(box.bottom, next.bottom) - Math.max(box.top, next.top) >
                1
            )
              issues.push(`${group.className} overlaps ${other.className}`);
          }
        }
        for (const button of hud.querySelectorAll("button")) {
          const box = button.getBoundingClientRect();
          if (!box.width || !box.height) continue;
          if (box.width < 44 || box.height < 44)
            issues.push(`${button.ariaLabel} is smaller than 44px`);
        }
        for (const label of hud.querySelectorAll<HTMLElement>(
          ".hud-card-name small, .hud-card-hp strong, .hud-clock > span, .hud-clock small, .hud-wind, .hud-power span, .hud-power strong",
        )) {
          const box = label.getBoundingClientRect();
          const panel = label.closest(".hud-panel")?.getBoundingClientRect();
          if (
            panel &&
            (box.left < panel.left + 2 ||
              box.right > panel.right - 2 ||
              box.top < panel.top + 2 ||
              box.bottom > panel.bottom - 2)
          )
            issues.push(`${label.textContent} clips its panel`);
        }
        return issues;
      }),
    )
    .toEqual([]);
}

export async function expectCameraToRespectHud(page: Page) {
  await expect
    .poll(() =>
      page.locator(".hud").evaluate((hud) => {
        const top = hud.querySelector(".hud-top")?.getBoundingClientRect();
        const bottom = hud
          .querySelector(".hud-bottom")
          ?.getBoundingClientRect();
        const canvas = document.querySelector("canvas");
        if (!top || !bottom || !canvas) return false;
        const height = Number(canvas.dataset.cameraFrameHeight);
        const width = Number(canvas.dataset.cameraFrameWidth);
        const bounds = hud.getBoundingClientRect();
        const style = getComputedStyle(hud);
        const expectedHeight = Math.max(
          160,
          bounds.height -
            Math.ceil(top.bottom - bounds.top + 8) -
            Math.ceil(bounds.bottom - bottom.top + 8),
        );
        const expectedWidth = Math.max(
          160,
          bounds.width -
            Number.parseFloat(style.paddingLeft) -
            Number.parseFloat(style.paddingRight),
        );
        return (
          Math.abs(height - expectedHeight) < 1 &&
          Math.abs(width - expectedWidth) < 1
        );
      }),
    )
    .toBe(true);
}
