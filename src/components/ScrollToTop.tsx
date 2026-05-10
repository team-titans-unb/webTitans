import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Restaura o scroll ao topo ao navegar entre rotas (evita herdar a posição da página anterior).
 * Se a URL tiver hash (ex.: /#inscricoes), rola até o elemento correspondente em vez do topo.
 */
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useLayoutEffect(() => {
    if (hash) {
      const id = hash.slice(1);
      if (id) {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "auto", block: "start" });
          return;
        }
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
