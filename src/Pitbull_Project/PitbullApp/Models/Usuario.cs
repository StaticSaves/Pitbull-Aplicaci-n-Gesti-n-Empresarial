namespace PitbullApp.Models
{
    public class Usuario
    {
        public int IdUsuario 
        { get; set;}

        public string NombreUsuario {get; set;} = default!;
        public string PasswordHash {get; set;} = default!; // Estamos guardando el codigo cifrado

        public int Idrol {get; set;}

        // Propiedades extras para saber que puede hacer el usuario dependiendo de los permisos

        public string NombreRol {get; set;} = string.Empty;
        public bool EstaActivo {get; set;}        

    }
}