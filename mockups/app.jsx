/* eslint-disable */
// PixDock — design canvas host with Tweaks (CRT intensity).

const { useState: useStateA, useEffect: useEffectA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "crtIntensity": 0.6,
  "showFlicker": true
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  // Apply CRT intensity globally via CSS var
  useEffectA(() => {
    document.documentElement.style.setProperty('--crt', tweaks.crtIntensity);
  }, [tweaks.crtIntensity]);

  const ART_W = 1280;
  const ART_H = 800;

  return (
    <>
      <window.DesignCanvas background="#07070f">
        <window.DCSection
          id="dashboards"
          title="PIXDOCK · DASHBOARD EXPLORATIONS"
          subtitle="Five retro directions, one healthy fleet · click any artboard to focus"
        >
          <window.DCArtboard id="v1" label="A · FAITHFUL — original shape, polished" width={ART_W} height={ART_H}>
            <V1Faithful />
          </window.DCArtboard>
          <window.DCArtboard id="v2" label="B · COMMAND CENTER — flight-deck dense" width={ART_W} height={ART_H}>
            <V2Command />
          </window.DCArtboard>
          <window.DCArtboard id="v3" label="C · ARCADE CABINET — chunky theatrical" width={ART_W} height={ART_H}>
            <V3Arcade />
          </window.DCArtboard>
          <window.DCArtboard id="v4" label="D · MAINFRAME — amber phosphor terminal" width={ART_W} height={ART_H}>
            <V4Mainframe />
          </window.DCArtboard>
          <window.DCArtboard id="v5" label="E · GAME BOY — 4-tone low density" width={ART_W} height={ART_H}>
            <V5GameBoy />
          </window.DCArtboard>
        </window.DCSection>
      </window.DesignCanvas>

      <window.TweaksPanel title="Tweaks">
        <window.TweakSection title="CRT EFFECT">
          <window.TweakSlider
            label="Intensity"
            value={tweaks.crtIntensity}
            min={0}
            max={1}
            step={0.05}
            onChange={v => setTweak('crtIntensity', v)}
          />
          <window.TweakToggle
            label="Flicker animation"
            value={tweaks.showFlicker}
            onChange={v => setTweak('showFlicker', v)}
          />
          <div style={{ fontSize: 11, color: '#888', lineHeight: 1.4, marginTop: 4 }}>
            Controls scanline opacity and vignette darkness across all five variations. Each variation also adds its own baseline (V3 and V4 push it harder).
          </div>
        </window.TweakSection>
      </window.TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
