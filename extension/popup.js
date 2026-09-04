const $ = (id) => document.getElementById(id);

async function getSession() {
  const { st_session } = await chrome.storage.local.get("st_session");
  return st_session || null;
}

function render(session) {
  if (session?.access_token) {
    $("login-form").classList.add("hidden");
    $("account").classList.remove("hidden");
    $("who").textContent = session.user?.email || "—";
  } else {
    $("account").classList.add("hidden");
    $("login-form").classList.remove("hidden");
  }
}

async function login(email, password) {
  const res = await fetch(`${ST_CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ST_CONFIG.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Falha no login");
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: data.user,
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  render(await getSession());

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("error").textContent = "";
    $("login-btn").disabled = true;
    try {
      const session = await login($("email").value.trim(), $("password").value);
      await chrome.storage.local.set({ st_session: session });
      render(session);
    } catch (err) {
      $("error").textContent = err.message;
    } finally {
      $("login-btn").disabled = false;
    }
  });

  $("logout-btn").addEventListener("click", async () => {
    await chrome.storage.local.remove("st_session");
    render(null);
  });
});
