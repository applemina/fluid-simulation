// Wait until the page is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // Select all links inside cards
  const simulatorLinks = document.querySelectorAll(".card a");

  simulatorLinks.forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault(); // prevent instant navigation
      const simulatorName = link.textContent.trim();

      // Show a message in the console
      console.log(`Opening simulator: ${simulatorName}`);

      // Add a small animation effect
      link.style.color = "#ffffff";
      link.style.backgroundColor = "#4dd0e1";
      link.style.padding = "5px 10px";
      link.style.borderRadius = "5px";

      // Navigate to the simulator after a short delay
      setTimeout(() => {
        window.location.href = link.href;
      }, 500);
    });
  });
});
